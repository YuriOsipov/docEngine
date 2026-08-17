import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { parseHTML } from 'linkedom';
import { SchemaRegistry } from '../registry/schema-registry.js';
import { attachRegistryToHolder } from '../registry/registry-context.js';

let buildProseFragmentPayload: any;
let pasteProseFragmentPayload: any;
let getProseFragmentSelectionRange: any;
let resolveProseClipboardEditable: any;
let FIELD_CLIPBOARD_MIME: any;

before(async () => {
  const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.Node = window.Node;
  globalThis.Range = window.Range;
  globalThis.DocumentFragment = window.DocumentFragment;
  globalThis.DOMParser = class {
    parseFromString(markup: any, mimeType: any) {
      if (mimeType !== 'text/html') {
        return parseHTML('<!DOCTYPE html><html><body></body></html>').document;
      }
      const html = String(markup ?? '');
      const wrapped = /<html[\s>]/i.test(html)
        ? html
        : `<!DOCTYPE html><html><body>${html}</body></html>`;
      return parseHTML(wrapped).document;
    }
  };
  globalThis.CSS = {
    escape: (value: string) => String(value).replace(/"/g, '\\"'),
  } as typeof CSS;

  if (!window.getSelection) {
    const win = window as any;
    win._testSelection = null;
    window.getSelection = () => {
      if (!win._testSelection) {
        win._testSelection = {
          _ranges: [] as any[],
          get rangeCount() {
            return this._ranges.length;
          },
          get isCollapsed() {
            return !this._ranges.length || !!this._ranges[0]?.collapsed;
          },
          get anchorNode() {
            return this._ranges[0]?.startContainer ?? null;
          },
          removeAllRanges() {
            this._ranges = [];
          },
          addRange(range: any) {
            this._ranges = [range];
          },
          getRangeAt(index: any) {
            return this._ranges[index];
          },
        };
      }
      return win._testSelection;
    };
  }

  const mod = await import('./field-clipboard.js');
  buildProseFragmentPayload = mod.buildProseFragmentPayload;
  pasteProseFragmentPayload = mod.pasteProseFragmentPayload;
  getProseFragmentSelectionRange = mod.getProseFragmentSelectionRange;
  resolveProseClipboardEditable = mod.resolveProseClipboardEditable;
  FIELD_CLIPBOARD_MIME = mod.FIELD_CLIPBOARD_MIME;
});

function buildEditorWithMixedContent() {
  const holder = document.createElement('div');
  holder.dataset.docEditor = '1';
  document.body.appendChild(holder);

  const section = document.createElement('div');
  section.className = 'document-section';
  section.dataset.sectionName = 'Header';
  holder.appendChild(section);

  const body = document.createElement('div');
  body.className = 'document-section__body';
  body.contentEditable = 'true';
  section.appendChild(body);

  const label = document.createTextNode('Patient: ');
  const token = document.createElement('span');
  token.className = 'field-token field-token--design';
  token.dataset.fieldId = 'patientName';
  token.dataset.placeholder = 'Patient Name';
  token.setAttribute('data-value', JSON.stringify('Jon Gibson'));
  token.textContent = 'Jon Gibson';
  body.appendChild(label);
  body.appendChild(token);

  const columns = document.createElement('div');
  columns.className = 'document-columns';
  const col0 = document.createElement('div');
  col0.className = 'document-columns__col';
  col0.dataset.column = '0';
  col0.contentEditable = 'true';
  columns.appendChild(col0);
  body.appendChild(columns);

  const registry = new SchemaRegistry();
  registry.updateFieldSchema('patientName', {
    type: 'text',
    name: 'Patient Name',
    label: 'Patient Name',
  });
  attachRegistryToHolder(holder, registry);

  return { holder, section, body, label, token, col0, registry };
}

function mockMixedRange(body: any, label: any, token: any) {
  const range: any = {
    collapsed: false,
    startContainer: label,
    startOffset: 0,
    endContainer: token,
    endOffset: 1,
    commonAncestorContainer: body,
    cloneContents() {
      const frag = document.createDocumentFragment();
      frag.appendChild(label.cloneNode(true));
      frag.appendChild(token.cloneNode(true));
      return frag;
    },
    deleteContents() {
      label.remove();
      token.remove();
    },
    cloneRange() {
      return this;
    },
  };
  return range;
}

describe('field-clipboard prose fragment', () => {
  it('exposes the field clipboard MIME type', () => {
    assert.equal(FIELD_CLIPBOARD_MIME, 'application/x-docengine-field');
  });

  it('builds a v3 payload with interleaved text and field segments', () => {
    const { section, body, label, token, registry } = buildEditorWithMixedContent();
    const range = mockMixedRange(body, label, token);
    const payload = buildProseFragmentPayload(range, 'cut', registry);

    assert.equal(payload.version, 3);
    assert.equal(payload.kind, 'prose-fragment');
    assert.equal(payload.action, 'cut');
    assert.ok(payload.segments.some((s: any) => s.type === 'text' && /Patient:/.test(s.content ?? s.html ?? '')));
    assert.ok(payload.segments.some((s: any) => s.type === 'field' && s.id === 'patientName'));
    assert.equal(payload.fieldSchemas.patientName?.name, 'Patient Name');
    assert.match(String(payload.plainText ?? ''), /Patient:/);
    section.remove();
  });

  it('pastes a cut fragment into a column cell, reusing the field id', () => {
    const { section, body, label, token, col0, registry } = buildEditorWithMixedContent();
    const range = mockMixedRange(body, label, token);
    const payload = buildProseFragmentPayload(range, 'cut', registry);
    range.deleteContents();
    registry.removeFieldSchema('patientName');

    const inserted = document.createTextNode('');
    col0.appendChild(inserted);
    const sel = window.getSelection()!;
    const caret: any = {
      collapsed: true,
      startContainer: inserted,
      startOffset: 0,
      endContainer: inserted,
      endOffset: 0,
      commonAncestorContainer: col0,
      deleteContents() {},
      insertNode(node: any) {
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          while (node.firstChild) {
            col0.insertBefore(node.firstChild, inserted);
          }
          return;
        }
        col0.insertBefore(node, inserted);
      },
    };
    sel.removeAllRanges();
    sel.addRange(caret);

    const tokens = pasteProseFragmentPayload(col0, payload, {
      getRegistry: () => registry,
      designMode: true,
    });

    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].dataset.fieldId, 'patientName');
    assert.equal(col0.contains(tokens[0]), true);
    assert.match(col0.textContent ?? '', /Patient:/);
    assert.match(col0.textContent ?? '', /Jon Gibson/);
    assert.ok(registry.getFieldSchemas().patientName);
    section.remove();
  });

  it('copy paste allocates a new field id', () => {
    const { section, body, label, token, col0, registry } = buildEditorWithMixedContent();
    const range = mockMixedRange(body, label, token);
    const payload = buildProseFragmentPayload(range, 'copy', registry);

    const inserted = document.createTextNode('');
    col0.appendChild(inserted);
    const sel = window.getSelection()!;
    const caret: any = {
      collapsed: true,
      startContainer: inserted,
      startOffset: 0,
      endContainer: inserted,
      endOffset: 0,
      commonAncestorContainer: col0,
      deleteContents() {},
      insertNode(node: any) {
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          while (node.firstChild) {
            col0.insertBefore(node.firstChild, inserted);
          }
          return;
        }
        col0.insertBefore(node, inserted);
      },
    };
    sel.removeAllRanges();
    sel.addRange(caret);

    const tokens = pasteProseFragmentPayload(col0, payload, {
      getRegistry: () => registry,
      designMode: true,
    });

    assert.equal(tokens.length, 1);
    assert.notEqual(tokens[0].dataset.fieldId, 'patientName');
    assert.match(col0.textContent ?? '', /Patient:/);
    // Original remains in body
    assert.equal(body.contains(token), true);
    section.remove();
  });

  it('getProseFragmentSelectionRange requires fields in the selection', () => {
    const { section, body, label, token } = buildEditorWithMixedContent();
    const range = mockMixedRange(body, label, token);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    // linkedom may not support contains the same way — helper uses editable.contains on containers
    // Mock contains on body
    const originalContains = body.contains.bind(body);
    body.contains = (node: any) =>
      node === label || node === token || node === body || originalContains(node);

    assert.equal(getProseFragmentSelectionRange(body), range);

    // Text-only range should return null
    const textOnly: any = {
      collapsed: false,
      startContainer: label,
      startOffset: 0,
      endContainer: label,
      endOffset: (label.textContent ?? '').length,
      commonAncestorContainer: body,
      cloneContents() {
        const frag = document.createDocumentFragment();
        frag.appendChild(label.cloneNode(true));
        return frag;
      },
    };
    sel.removeAllRanges();
    sel.addRange(textOnly);
    assert.equal(getProseFragmentSelectionRange(body), null);

    section.remove();
  });

  it('strips drag-handle chrome from plainText in the clipboard payload', () => {
    const { section, body, label, token, registry } = buildEditorWithMixedContent();
    const handle = document.createElement('span');
    handle.className = 'editor-drag-handle';
    const hint = document.createElement('span');
    hint.className = 'editor-drag-handle__hint-title';
    hint.textContent = 'Drag to move';
    handle.appendChild(hint);
    token.insertBefore(handle, token.firstChild);

    const range = mockMixedRange(body, label, token);
    const payload = buildProseFragmentPayload(range, 'copy', registry);
    assert.ok(payload);
    assert.doesNotMatch(String(payload.plainText ?? ''), /Drag to move/);
    section.remove();
  });

  it('resolveProseClipboardEditable prefers nested column over section body', () => {
    const { section, col0 } = buildEditorWithMixedContent();
    const text = document.createTextNode('x');
    col0.appendChild(text);
    assert.equal(resolveProseClipboardEditable(text), col0);
    section.remove();
  });
});
