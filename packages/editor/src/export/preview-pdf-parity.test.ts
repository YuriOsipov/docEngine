import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { before, describe, it } from 'node:test';
import { parseHTML } from 'linkedom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mammologyTemplate = JSON.parse(
  readFileSync(join(__dirname, '../../../../examples/mammology-document-template.json'), 'utf8'),
);

let renderDocumentPreview: any;
let previewDomToPdfContent: any;
let createRenderDocumentToPdfDefinitionFromPreview: any;
let buildFontRegistry: any;
let shouldUseLegacyPdfExport: any;

const filledFieldValues = {
  statusLocalis: ['дольчата'],
  focalPalpation: ['до 1 см'],
  diagnosis: ['Складна кіста'],
  recommended: ['Кор-біопсія'],
};

before(async () => {
  const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  globalThis.document = window.document;
  globalThis.Node = window.Node;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.DocumentFragment = window.DocumentFragment;
  globalThis.DOMParser = class {
    parseFromString(markup: any,mimeType: any) {
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

  const preview = await import('../fields/document-preview.js');
  renderDocumentPreview = preview.renderDocumentPreview;

  const pdfPreview: any = await import('@docengine/pdf-renderer/browser');
  previewDomToPdfContent = pdfPreview.previewDomToPdfContent;
  createRenderDocumentToPdfDefinitionFromPreview =
    pdfPreview.createRenderDocumentToPdfDefinitionFromPreview;
  buildFontRegistry = pdfPreview.buildFontRegistry;
  shouldUseLegacyPdfExport = pdfPreview.shouldUseLegacyPdfExport;
});

function nodeTextJoined(node: any) {
  if (!node) return '';
  if (Array.isArray(node.text)) {
    return node.text.map((part: any) => (typeof part === 'string' ? part : String(part.text ?? ''))).join('');
  }
  if (Array.isArray(node.stack)) {
    return node.stack.map((child: any) => nodeTextJoined(child)).join('');
  }
  if (Array.isArray(node.columns)) {
    return node.columns.map((col: any) => nodeTextJoined(col)).join('');
  }
  return String(node.text ?? '');
}

function collectInlineParts(nodes: any,parts: any = []) {
  for (const node of nodes ?? []) {
    if (Array.isArray(node?.text)) {
      for (const part of node.text) {
        if (typeof part === 'string') parts.push({ text: part });
        else parts.push(part);
      }
    }
    if (Array.isArray(node?.stack)) collectInlineParts(node.stack, parts);
    if (Array.isArray(node?.columns)) {
      for (const col of node.columns) collectInlineParts(col.stack, parts);
    }
  }
  return parts;
}

describe('preview-first PDF parity', () => {
  const formattedExamSegments = [
    { type: 'text', html: '<b>ST.LOCALIS: </b>' },
    { type: 'field', id: 'statusLocalis' },
    { type: 'text', html: '<b>.\nВогнещевої патології пальпаторно: </b>' },
    { type: 'field', id: 'focalPalpation' },
    { type: 'text', html: '<b>.\nДІАГНОЗ: </b>' },
    { type: 'field', id: 'diagnosis' },
  ];

  const formattedRecommendationSegments = [
    { type: 'text', html: '<div class="document-align document-align--center" style="text-align: center"><h2>Рекомендовано</h2></div>' },
    { type: 'field', id: 'recommended' },
  ];

  it('exports formatted mammology preview DOM with bold labels and centered h2', () => {
    const doc = {
      kind: 'document',
      version: 2,
      time: Date.now(),
      fieldSchemas: mammologyTemplate.fieldSchemas,
      blocks: [
        {
          type: 'documentSection',
          data: {
            label: 'Огляд',
            segments: formattedExamSegments,
            fieldValues: filledFieldValues,
          },
        },
        {
          type: 'documentSection',
          data: {
            label: 'Рекомендації',
            segments: formattedRecommendationSegments,
            fieldValues: filledFieldValues,
          },
        },
      ],
    };

    const previewRoot = renderDocumentPreview(doc);
    const previewText = previewRoot.textContent ?? '';
    assert.match(previewText, /ST\.LOCALIS:/);
    assert.match(previewText, /дольчата/);
    assert.match(previewText, /ДІАГНОЗ:/);
    assert.match(previewText, /Рекомендовано/);
    assert.match(previewText, /Кор-біопсія/);

    const fontRegistry = buildFontRegistry({ preset: 'Roboto' });
    const pdfContent = previewDomToPdfContent(previewRoot, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const pdfText = pdfContent.map((node: any) => nodeTextJoined(node)).join('\n');
    assert.match(pdfText, /ST\.LOCALIS:/);
    assert.match(pdfText, /дольчата/);
    assert.match(pdfText, /ДІАГНОЗ:/);
    assert.match(pdfText, /Рекомендовано/);
    assert.match(pdfText, /Кор-біопсія/);

    const parts = collectInlineParts(pdfContent);
    assert.ok(parts.some((part: any) => part.bold === true && String(part.text ?? '').includes('ST.LOCALIS')));
    assert.ok(parts.some((part: any) => part.bold === false && String(part.text ?? '').includes('дольчата')));
    assert.ok(parts.some((part: any) => part.bold === false && String(part.text ?? '').includes('до 1 см')));

    const headingBlock = pdfContent
      .flatMap((node: any) => /** @type {Array<Record<string, unknown>>} */ (node.stack ?? []))
      .find((node: any) => nodeTextJoined(node).includes('Рекомендовано') && node.alignment === 'center');
    assert.ok(headingBlock, 'centered recommendation heading should appear in pdf content');
    const headingParts = /** @type {Array<Record<string, unknown>>} */ (headingBlock.text ?? []);
    assert.equal(headingParts[0]?.fontSize, 16.2);

    const fieldPart = parts.find((part: any) => String(part.text ?? '').includes('дольчата'));
    assert.ok(fieldPart, 'field value should appear in pdf content');
    assert.equal(fieldPart.decoration, undefined);
    assert.equal(fieldPart.font, 'Roboto');
  });

  it('keeps mammology on preview-first export routing', () => {
    const doc = {
      kind: 'document',
      version: 2,
      time: Date.now(),
      fieldSchemas: mammologyTemplate.fieldSchemas,
      blocks: [
        {
          type: 'documentSection',
          data: {
            label: 'Огляд',
            segments: formattedExamSegments,
            fieldValues: filledFieldValues,
          },
        },
      ],
    };

    assert.equal(shouldUseLegacyPdfExport(doc), false);
  });

  it('uses preview-first routing and produces a page header for repeatable section', () => {
    const doc = {
      kind: 'document',
      version: 2,
      time: Date.now(),
      fieldSchemas: {
        complaints: { type: 'tree', name: 'Complaints', label: 'Complaints' },
      },
      blocks: [
        {
          type: 'documentSection',
          data: {
            label: 'Anamnesis',
            name: 'Anamnesis',
            repeatable: true,
            segments: [
              { type: 'text', content: 'Complaints: ' },
              { type: 'field', id: 'complaints' },
            ],
            fieldValues: { complaints: ['Tearing'] },
          },
        },
        {
          type: 'documentSection',
          data: {
            label: 'Examination',
            segments: [{ type: 'text', content: 'Exam findings' }],
          },
        },
      ],
    };

    assert.equal(shouldUseLegacyPdfExport(doc), false);

    const fontRegistry = buildFontRegistry({ preset: 'Roboto' });
    const render = createRenderDocumentToPdfDefinitionFromPreview(() => fontRegistry);
    const previewRoot = renderDocumentPreview(doc);
    const { docDefinition } = render(previewRoot, doc);

    assert.equal(typeof docDefinition.header, 'function');
    const headerContent = docDefinition.header();
    const headerText = JSON.stringify(headerContent);
    assert.match(headerText, /Anamnesis/);
    assert.match(headerText, /Tearing/);

    const mainText = JSON.stringify(docDefinition.content);
    assert.doesNotMatch(mainText, /Anamnesis/);
    assert.match(mainText, /Exam/);
  });
});
