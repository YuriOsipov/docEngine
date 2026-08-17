import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  configureImageUpload,
  uploadByFile,
  uploadByUrl,
  fileToDataUrl,
  normalizeImageValue,
  isImageValueEmpty,
} from './image-upload.js';

describe('image-upload stub', () => {
  const originalWarn = console.warn;
  let warnings: string[];

  beforeEach(() => {
    warnings = [];
    console.warn = (...args: any[]) => {
      warnings.push(args.map(String).join(' '));
    };
    configureImageUpload({ uploadUrl: '', stub: true });
  });

  afterEach(() => {
    console.warn = originalWarn;
    configureImageUpload({ uploadUrl: '', stub: true });
  });

  it('fileToDataUrl returns a data: URL', async () => {
    const file = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], 'logo.png', {
      type: 'image/png',
    });
    const url = await fileToDataUrl(file);
    assert.ok(url.startsWith('data:image/png;base64,'));
  });

  it('stub uploadByFile stores a persistable data URL (not blob:)', async () => {
    const file = new File([Uint8Array.from([1, 2, 3, 4])], 'mark.png', {
      type: 'image/png',
    });
    const result = await uploadByFile(file);
    assert.equal(result.success, 1);
    assert.equal(result.file.stub, true);
    assert.equal(result.file.name, 'mark.png');
    assert.ok(result.file.url.startsWith('data:image/png;base64,'));
    assert.ok(!result.file.url.startsWith('blob:'));
    assert.ok(warnings.some((w) => w.includes('stub uploader')));
  });

  it('shows a visible placeholder for empty image fields in design/fill', async () => {
    const { parseHTML } = await import('linkedom');
    const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
    globalThis.document = window.document;

    const { registerBuiltinFields } = await import('../fields/handlers/index.js');
    registerBuiltinFields();
    const { SchemaRegistry } = await import('../registry/schema-registry.js');
    const { createFieldToken } = await import('../fields/inline-fields.js');

    const registry = new SchemaRegistry();
    registry.updateFieldSchema('photo', {
      type: 'image',
      name: 'Image',
      label: 'Image',
      maxWidth: 320,
    });
    const ctx = { getRegistry: () => registry };

    const empty = createFieldToken('photo', { url: '', caption: '' }, 'Image', ctx);
    assert.equal(empty.textContent, 'Image');
    assert.ok(empty.classList.contains('field-token--empty'));
    assert.equal(empty.querySelector('img.field-token__thumb'), null);

    const previewEmpty = createFieldToken('photo', '', 'Image', {
      ...ctx,
      previewMode: true,
    });
    assert.equal(previewEmpty.textContent, '');
    assert.ok(previewEmpty.classList.contains('field-token--empty'));
  });

  it('does not put large data URLs into token data-value (LWS attribute limit)', async () => {
    const { parseHTML } = await import('linkedom');
    const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
    globalThis.document = window.document;

    const { registerBuiltinFields } = await import('../fields/handlers/index.js');
    registerBuiltinFields();
    const { SchemaRegistry } = await import('../registry/schema-registry.js');
    const {
      createFieldToken,
      readTokenValue,
      recoverImageValuesFromDom,
    } = await import('../fields/inline-fields.js');

    const registry = new SchemaRegistry();
    registry.updateFieldSchema('logo', {
      type: 'image',
      name: 'logo',
      label: 'logo',
      maxWidth: 320,
    });

    const dataUrl = `data:image/png;base64,${'A'.repeat(5000)}`;
    const token = createFieldToken(
      'logo',
      { url: dataUrl, caption: 'Cap' },
      'logo',
      { getRegistry: () => registry },
    );

    assert.ok(token.querySelector('img.field-token__thumb'));
    assert.ok(!String(token.dataset.value ?? '').includes('data:image'));
    assert.ok(token.dataset.value.includes('"embedded":true'));

    const fromDataset = readTokenValue(token);
    assert.equal(fromDataset.url, dataUrl, 'readTokenValue should recover URL from live <img>');
    assert.equal(fromDataset.caption, 'Cap');

    const recovered = recoverImageValuesFromDom(token.parentElement ?? token, {
      logo: { url: '', caption: '' },
    });
    assert.equal(recovered.logo.url, dataUrl);
  });

  it('stub uploadByUrl keeps the provided URL', async () => {
    const result = await uploadByUrl('https://example.com/logo.png');
    assert.equal(result.success, 1);
    assert.equal(result.file.url, 'https://example.com/logo.png');
  });

  it('custom uploadByFile bypasses stub', async () => {
    configureImageUpload({
      stub: true,
      uploadUrl: '',
      uploadByFile: async (file: File) => ({
        success: 1 as const,
        file: { url: `https://cdn.example/${file.name}`, name: file.name },
      }),
    });
    const file = new File([Uint8Array.from([1, 2, 3])], 'logo.png', { type: 'image/png' });
    const result = await uploadByFile(file);
    assert.equal(result.file.url, 'https://cdn.example/logo.png');
    assert.ok(!warnings.some((w) => w.includes('stub uploader')));
  });

  it('listExistingImages and resolveExistingImage use host callbacks', async () => {
    const { listExistingImages, resolveExistingImage, canListExistingImages } = await import(
      './image-upload.js'
    );
    configureImageUpload({
      stub: true,
      listExistingImages: async () => [{ id: '068xx', name: 'logo.png', url: 'https://thumb/logo' }],
      resolveExistingImage: async (id: string) => ({
        success: 1 as const,
        file: { url: `https://cdn.example/${id}`, name: 'logo.png' },
      }),
    });
    assert.equal(canListExistingImages(), true);
    const items = await listExistingImages();
    assert.equal(items.length, 1);
    assert.equal(items[0].id, '068xx');
    const resolved = await resolveExistingImage('068xx');
    assert.equal(resolved.file.url, 'https://cdn.example/068xx');

    configureImageUpload({ uploadUrl: '', stub: true });
    assert.equal(canListExistingImages(), false);
  });

  it('normalizeImageValue and isImageValueEmpty handle data URLs', () => {
    const value = normalizeImageValue({
      url: 'data:image/png;base64,aaaa',
      caption: 'Logo',
    });
    assert.equal(value.url, 'data:image/png;base64,aaaa');
    assert.equal(value.caption, 'Logo');
    assert.equal(isImageValueEmpty(value), false);
    assert.equal(isImageValueEmpty({ url: '' }), true);
  });
});
