import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { parseHTML } from 'linkedom';
import { buildFontRegistry } from './fonts-browser-registry.js';
import { previewDomToPdfContent } from './preview-dom-to-pdf.js';

const fontRegistry = buildFontRegistry({ preset: 'Roboto' });

before(() => {
  const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  globalThis.document = window.document;
  globalThis.Node = window.Node;
});

function nodeTextJoined(node: any): string {
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
  if (node.table?.body) {
    return node.table.body
      .map((row: any) => (row ?? []).map((cell: any) => nodeTextJoined(cell)).join('|'))
      .join('\n');
  }
  return String(node.text ?? '');
}

function collectInlineParts(nodes: any, parts: any[] = []): any[] {
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
    if (Array.isArray(node?.table?.body)) {
      for (const row of node.table.body) {
        collectInlineParts(row ?? [], parts);
      }
    }
  }
  return parts;
}

function findPdfTableNodes(nodes: any, found: any[] = []): any[] {
  for (const node of nodes ?? []) {
    if (node?.table) {
      found.push(node);
      for (const row of node.table.body ?? []) {
        for (const cell of row ?? []) {
          if (Array.isArray(cell?.stack)) findPdfTableNodes(cell.stack, found);
        }
      }
    }
    if (Array.isArray(node?.stack)) findPdfTableNodes(node.stack, found);
    if (Array.isArray(node?.columns)) {
      for (const col of node.columns) findPdfTableNodes(col.stack, found);
    }
  }
  return found;
}

function buildInlineVisionTableDom() {
  const tableWrap = document.createElement('div');
  tableWrap.className = 'document-table';
  tableWrap.innerHTML = [
    '<table class="vision-table">',
    '<thead><tr><th>Column 1</th><th>Column 2</th></tr></thead>',
    '<tbody>',
    '<tr><td><span class="field-token field-token--preview">111</span></td><td></td></tr>',
    '<tr><td><span class="field-token field-token--preview">222</span></td><td></td></tr>',
    '</tbody>',
    '</table>',
  ].join('');
  return tableWrap;
}

function buildRepeaterWithColumnsDom(leftText: any, rightText: any) {
  const columns = document.createElement('div');
  columns.className = 'document-columns';
  columns.innerHTML = [
    '<div class="document-columns__grid">',
    `<div class="document-columns__col"><span>City : </span><span class="field-token field-token--preview">${leftText}</span></div>`,
    `<div class="document-columns__col"><span>City : </span><span class="field-token field-token--preview">${rightText}</span></div>`,
    '</div>',
  ].join('');

  const sectionBody = document.createElement('div');
  sectionBody.className = 'preview-document__section document-section__body';
  sectionBody.appendChild(columns);

  const sectionWrap = document.createElement('div');
  sectionWrap.className = 'preview-document__section-wrap';
  sectionWrap.appendChild(sectionBody);

  const nestedPreview = document.createElement('div');
  nestedPreview.className = 'preview-document';
  nestedPreview.appendChild(sectionWrap);

  const instanceBody = document.createElement('div');
  instanceBody.className = 'field-token__repeater-instance-body';
  instanceBody.appendChild(nestedPreview);

  const repeaterPreview = document.createElement('span');
  repeaterPreview.className = 'field-token__repeater-preview';
  repeaterPreview.appendChild(instanceBody);

  const repeaterToken = document.createElement('span');
  repeaterToken.className = 'field-token field-token--preview field-token--repeater';
  repeaterToken.appendChild(repeaterPreview);

  return repeaterToken;
}

function findPdfColumnNodes(nodes: any, found: any[] = []): any[] {
  for (const node of nodes ?? []) {
    if (Array.isArray(node?.columns)) found.push(node);
    if (Array.isArray(node?.stack)) findPdfColumnNodes(node.stack, found);
    if (Array.isArray(node?.columns)) {
      for (const col of node.columns) findPdfColumnNodes(col.stack, found);
    }
  }
  return found;
}

describe('previewDomToPdfContent', () => {
  it('converts preview section wrap with bold label and field token without underline', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';

    const wrap = document.createElement('div');
    wrap.className = 'preview-document__section-wrap';

    const header = document.createElement('div');
    header.className = 'document-section__header';
    const label = document.createElement('span');
    label.className = 'document-section__label-text';
    label.textContent = 'Огляд';
    header.appendChild(label);
    wrap.appendChild(header);

    const body = document.createElement('div');
    body.className = 'preview-document__section document-section__body';
    body.innerHTML = '<b>ST.LOCALIS: </b><span class="field-token field-token--preview" style="font-weight: normal">дольчата</span>';
    wrap.appendChild(body);
    root.appendChild(wrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    assert.equal(content.length, 1);
    const prose = nodeTextJoined(content[0]);
    assert.match(prose, /ST\.LOCALIS:/);
    assert.match(prose, /дольчата/);

    const parts = collectInlineParts(content);
    const labelPart = parts.find((part: any) => String(part.text ?? '').includes('ST.LOCALIS'));
    const fieldPart = parts.find((part: any) => String(part.text ?? '').includes('дольчата'));
    assert.equal(labelPart?.bold, true);
    assert.equal(fieldPart?.bold, false);
    assert.equal(fieldPart?.decoration, undefined);
    assert.equal(fieldPart?.font, 'Roboto');
  });

  it('preserves intentional field underline from displayStyle in PDF', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';

    const wrap = document.createElement('div');
    wrap.className = 'preview-document__section-wrap';

    const body = document.createElement('div');
    body.className = 'preview-document__section document-section__body';
    body.innerHTML =
      '<span>Life history: </span><span class="field-token field-token--preview" style="font-style: italic; text-decoration: underline">Chronic conditions</span>';
    wrap.appendChild(body);
    root.appendChild(wrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const parts = collectInlineParts(content);
    const fieldPart = parts.find((part: any) => String(part.text ?? '').includes('Chronic conditions'));
    assert.equal(fieldPart?.italics, true);
    assert.equal(fieldPart?.decoration, 'underline');
  });

  it('preserves intentional field underline on vision table cell tokens', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';
    root.innerHTML = [
      '<div class="preview-document__section-wrap">',
      '<div class="preview-document__section document-section__body">',
      '<div class="vision-table-container"><table class="vision-table">',
      '<thead><tr><th>Sph</th></tr></thead>',
      '<tbody><tr><td>',
      '<span class="field-token field-token--preview field-token--cell" style="font-weight: bold; text-decoration: underline">-3.0</span>',
      '</td></tr></tbody>',
      '</table></div></div></div>',
    ].join('');

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const parts = collectInlineParts(content);
    const fieldPart = parts.find((part: any) => String(part.text ?? '').includes('-3.0'));
    assert.equal(fieldPart?.bold, true);
    assert.equal(fieldPart?.decoration, 'underline');
  });

  it('converts centered h2 blocks from preview DOM', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';

    const wrap = document.createElement('div');
    wrap.className = 'preview-document__section-wrap';
    const body = document.createElement('div');
    body.className = 'preview-document__section document-section__body';
    body.innerHTML = '<div class="document-align document-align--center" style="text-align: center"><h2>Рекомендовано</h2></div>';
    wrap.appendChild(body);
    root.appendChild(wrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const prose = nodeTextJoined(content[0]);
    assert.match(prose, /Рекомендовано/);
    const stack = content[0].stack as any[];
    const headingBlock = stack.find((node: any) => nodeTextJoined(node).includes('Рекомендовано'));
    assert.equal(headingBlock?.alignment, 'center');
    const headingParts = (headingBlock?.text ?? []) as any[];
    assert.equal(headingParts[0]?.fontSize, 16.2);
  });

  it('preserves line breaks in field tokens and emits hr as horizontal rule', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';

    const wrap = document.createElement('div');
    wrap.className = 'preview-document__section-wrap';
    const body = document.createElement('div');
    body.className = 'preview-document__section document-section__body';
    body.innerHTML = [
      '<span class="field-token field-token--preview">line one\nline two</span>',
      '<hr>',
      '<b>After rule</b>',
    ].join('');
    wrap.appendChild(body);
    root.appendChild(wrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const parts = collectInlineParts(content);
    const fieldText = parts.map((part: any) => (typeof part === 'string' ? part : String(part.text ?? ''))).join('');
    assert.match(fieldText, /line one[\s\S]*line two/);

    const stack = content[0].stack as any[];
    assert.ok(stack.some((node: any) => Array.isArray(node.canvas)));
    assert.ok(parts.some((part: any) => part.bold === true && String(part.text ?? '').includes('After rule')));
  });

  it('converts inline document-table inside section body to pdfmake table grid', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';

    const wrap = document.createElement('div');
    wrap.className = 'preview-document__section-wrap';

    const header = document.createElement('div');
    header.className = 'document-section__header';
    const label = document.createElement('span');
    label.className = 'document-section__label-text';
    label.textContent = 'items';
    header.appendChild(label);
    wrap.appendChild(header);

    const body = document.createElement('div');
    body.className = 'preview-document__section document-section__body';
    body.appendChild(buildInlineVisionTableDom());
    wrap.appendChild(body);
    root.appendChild(wrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const tableNodes = findPdfTableNodes(content);
    assert.equal(tableNodes.length, 1);

    const pdfTable = tableNodes[0].table as any;
    assert.equal(pdfTable.headerRows, 1);
    assert.equal(pdfTable.keepWithHeaderRows, 1);
    assert.equal(pdfTable.body?.length, 3);
    assert.equal(pdfTable.body?.[0]?.length, 2);
    assert.equal(pdfTable.body?.[1]?.length, 2);

    const headerText = nodeTextJoined(pdfTable.body?.[0]?.[0]);
    assert.match(headerText, /Column 1/);
    const firstCellText = nodeTextJoined(pdfTable.body?.[1]?.[0]);
    const secondCellText = nodeTextJoined(pdfTable.body?.[2]?.[0]);
    assert.match(firstCellText, /111/);
    assert.match(secondCellText, /222/);
  });

  it('converts borderless headerless vision-tables from preview DOM', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';

    const wrap = document.createElement('div');
    wrap.className = 'preview-document__section-wrap';

    const body = document.createElement('div');
    body.className = 'preview-document__section document-section__body';
    const tableWrap = document.createElement('div');
    tableWrap.className = 'document-table';
    tableWrap.innerHTML = [
      '<table class="vision-table vision-table--borderless vision-table--no-header">',
      '<tbody>',
      '<tr><td><span class="field-token field-token--preview">111</span></td>',
      '<td><span class="field-token field-token--preview">222</span></td></tr>',
      '</tbody>',
      '</table>',
    ].join('');
    body.appendChild(tableWrap);
    wrap.appendChild(body);
    root.appendChild(wrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const tableNodes = findPdfTableNodes(content);
    assert.equal(tableNodes.length, 1);
    const pdfTable = tableNodes[0].table as any;
    assert.equal(pdfTable.headerRows, 0);
    assert.equal(pdfTable.body?.length, 1);
    assert.equal(pdfTable.body?.[0]?.length, 2);
    assert.equal((tableNodes[0] as any).layout?.hLineWidth?.(), 0);
    assert.equal((tableNodes[0] as any).layout?.vLineWidth?.(), 0);
  });

  it('keeps outer table shape when Child cells contain nested vision-tables', () => {
    const nestedTable = document.createElement('div');
    nestedTable.className = 'document-table';
    nestedTable.innerHTML = [
      '<table class="vision-table">',
      '<thead><tr><th>id</th><th>name</th></tr></thead>',
      '<tbody>',
      '<tr data-row-key="row1"><td><span class="field-token field-token--preview">10</span></td>',
      '<td><span class="field-token field-token--preview">1111</span></td></tr>',
      '<tr data-row-key="row2"><td><span class="field-token field-token--preview">10</span></td>',
      '<td><span class="field-token field-token--preview">name2</span></td></tr>',
      '</tbody>',
      '</table>',
    ].join('');

    const nestedSectionBody = document.createElement('div');
    nestedSectionBody.className = 'preview-document__section document-section__body';
    nestedSectionBody.appendChild(nestedTable);

    const nestedSectionWrap = document.createElement('div');
    nestedSectionWrap.className = 'preview-document__section-wrap';
    const nestedHeader = document.createElement('div');
    nestedHeader.className = 'document-section__header';
    const nestedLabel = document.createElement('span');
    nestedLabel.className = 'document-section__label-text';
    nestedLabel.textContent = 'item';
    nestedHeader.appendChild(nestedLabel);
    nestedSectionWrap.appendChild(nestedHeader);
    nestedSectionWrap.appendChild(nestedSectionBody);

    const nestedPreview = document.createElement('div');
    nestedPreview.className = 'preview-document';
    nestedPreview.appendChild(nestedSectionWrap);

    const instanceBody = document.createElement('div');
    instanceBody.className = 'field-token__repeater-instance-body';
    instanceBody.appendChild(nestedPreview);

    const repeaterPreview = document.createElement('span');
    repeaterPreview.className = 'field-token__repeater-preview';
    repeaterPreview.appendChild(instanceBody);

    const childToken = document.createElement('span');
    childToken.className = 'field-token field-token--preview field-token--repeater field-token--cell';
    childToken.appendChild(repeaterPreview);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'document-table';
    const outerTable = document.createElement('table');
    outerTable.className = 'vision-table';
    outerTable.innerHTML = [
      '<thead><tr><th>id</th><th>item</th></tr></thead>',
      '<tbody><tr data-row-key="row1"></tr></tbody>',
    ].join('');
    const outerRow = outerTable.querySelector('tbody tr')!;
    const tdId = document.createElement('td');
    tdId.innerHTML = '<span class="field-token field-token--preview">1</span>';
    const tdItem = document.createElement('td');
    tdItem.appendChild(childToken);
    outerRow.appendChild(tdId);
    outerRow.appendChild(tdItem);
    tableWrap.appendChild(outerTable);

    const root = document.createElement('div');
    root.className = 'preview-document';
    const wrap = document.createElement('div');
    wrap.className = 'preview-document__section-wrap';
    const body = document.createElement('div');
    body.className = 'preview-document__section document-section__body';
    body.appendChild(tableWrap);
    wrap.appendChild(body);
    root.appendChild(wrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const tableNodes = findPdfTableNodes(content);
    assert.ok(tableNodes.length >= 2, 'outer table plus nested Child table');

    const outerPdf = tableNodes[0].table as any;
    // Nested Child rows must not inflate the outer table.
    assert.equal(outerPdf.body?.length, 2, 'header + 1 outer body row');
    assert.equal(outerPdf.body?.[0]?.length, 2);
    assert.equal(outerPdf.body?.[1]?.length, 2);

    const idCellText = nodeTextJoined(outerPdf.body?.[1]?.[0]);
    assert.match(idCellText, /^1$/);

    const childCell = outerPdf.body?.[1]?.[1];
    assert.ok(Array.isArray(childCell?.stack), 'Child cell should be a nested stack');
    const childText = nodeTextJoined(childCell);
    assert.match(childText, /1111/);
    assert.match(childText, /name2/);

    const nestedPdf = tableNodes.find((node: any) => {
      const header = nodeTextJoined(node.table?.body?.[0]?.[0] ?? {});
      return header === 'id' && node !== tableNodes[0];
    });
    assert.ok(nestedPdf, 'nested Child vision-table should be converted');
    assert.equal((nestedPdf as any).table.body?.length, 3, 'nested header + 2 data rows');
  });

  it('uses colgroup column widths in pdfmake table definition', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';

    const wrap = document.createElement('div');
    wrap.className = 'preview-document__section-wrap';

    const body = document.createElement('div');
    body.className = 'preview-document__section document-section__body';
    const tableWrap = document.createElement('div');
    tableWrap.className = 'document-table';
    tableWrap.innerHTML = [
      '<table class="vision-table">',
      '<colgroup><col style="width: 80%"><col style="width: 20%"></colgroup>',
      '<thead><tr><th>Name</th><th>Amount</th></tr></thead>',
      '<tbody><tr><td>Test</td><td>2</td></tr></tbody>',
      '</table>',
    ].join('');
    body.appendChild(tableWrap);
    wrap.appendChild(body);
    root.appendChild(wrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const tableNodes = findPdfTableNodes(content);
    assert.equal(tableNodes.length, 1);
    assert.deepEqual((tableNodes[0] as any).table.widths, ['80%', '20%']);
  });

  it('skips repeatable section label and prose from main content', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';

    const repeatableWrap = document.createElement('div');
    repeatableWrap.className = 'preview-document__section-wrap';
    repeatableWrap.dataset.repeatable = 'true';
    const repeatableHeader = document.createElement('div');
    repeatableHeader.className = 'document-section__header';
    const repeatableLabel = document.createElement('span');
    repeatableLabel.className = 'document-section__label-text';
    repeatableLabel.textContent = 'Anamnesis';
    repeatableHeader.appendChild(repeatableLabel);
    repeatableWrap.appendChild(repeatableHeader);
    root.appendChild(repeatableWrap);

    const normalWrap = document.createElement('div');
    normalWrap.className = 'preview-document__section-wrap';
    const normalHeader = document.createElement('div');
    normalHeader.className = 'document-section__header';
    const normalLabel = document.createElement('span');
    normalLabel.className = 'document-section__label-text';
    normalLabel.textContent = 'Examination';
    normalHeader.appendChild(normalLabel);
    normalWrap.appendChild(normalHeader);
    root.appendChild(normalWrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const text = content.map((n) => nodeTextJoined(n)).join('\n');
    assert.doesNotMatch(text, /Anamnesis/);
    assert.match(text, /Examination/);
  });

  it('exports tables from repeatable section body content', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';

    const repeatableWrap = document.createElement('div');
    repeatableWrap.className = 'preview-document__section-wrap';
    repeatableWrap.dataset.repeatable = 'true';

    const repeatableHeader = document.createElement('div');
    repeatableHeader.className = 'document-section__header';
    const repeatableLabel = document.createElement('span');
    repeatableLabel.className = 'document-section__label-text';
    repeatableLabel.textContent = 'header';
    repeatableHeader.appendChild(repeatableLabel);
    repeatableWrap.appendChild(repeatableHeader);

    const sectionBody = document.createElement('div');
    sectionBody.className = 'preview-document__section document-section__body';
    sectionBody.innerHTML = [
      '<span>patient name : </span>',
      '<span class="field-token field-token--preview">sample_first_name</span>',
      buildInlineVisionTableDom().outerHTML,
    ].join('');
    repeatableWrap.appendChild(sectionBody);
    root.appendChild(repeatableWrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const tableNodes = findPdfTableNodes(content);
    assert.equal(tableNodes.length, 1);
    assert.equal(content.length, 1);
    assert.doesNotMatch(
      content.map((n) => nodeTextJoined(n)).join('\n'),
      /No filled content to export/,
    );

    const tableText = (tableNodes[0] as any).table.body
      .flatMap((row: any) => row.map((cell: any) => nodeTextJoined(cell)))
      .join(' ');
    assert.match(tableText, /111/);
    assert.match(tableText, /222/);
    assert.doesNotMatch(tableText, /sample_first_name/);
  });

  it('reads cell alignment from inner field-token when td has no inline alignment', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';

    const block = document.createElement('div');
    block.className = 'preview-document__block';

    block.innerHTML = [
      '<table class="vision-table">',
      '<thead><tr><th>Left</th><th>Center</th><th>Right</th></tr></thead>',
      '<tbody>',
      '<tr>',
      '<td><span class="field-token field-token--preview">A</span></td>',
      '<td><span class="field-token field-token--preview" style="text-align: center; display: block; width: 100%">B</span></td>',
      '<td><span class="field-token field-token--preview" style="text-align: right; display: block; width: 100%">C</span></td>',
      '</tr>',
      '</tbody>',
      '</table>',
    ].join('');

    root.appendChild(block);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const tableNodes = findPdfTableNodes(content);
    assert.equal(tableNodes.length, 1);

    const body = (tableNodes[0] as any).table.body;
    const dataRow = body[1];
    assert.equal(dataRow[0].alignment, undefined);
    assert.equal(dataRow[1].alignment, 'center');
    assert.equal(dataRow[2].alignment, 'right');
  });

  it('maps mark and code tags to pdfmake background styles', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';

    const wrap = document.createElement('div');
    wrap.className = 'preview-document__section-wrap';
    const body = document.createElement('div');
    body.className = 'preview-document__section document-section__body';
    body.innerHTML = '<mark>highlighted</mark> and <code>inline()</code>';
    wrap.appendChild(body);
    root.appendChild(wrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const parts = collectInlineParts(content);
    const markPart = parts.find((part: any) => String(part.text ?? '').includes('highlighted'));
    const codePart = parts.find((part: any) => String(part.text ?? '').includes('inline()'));
    assert.equal(markPart?.background, '#FFF59D');
    assert.equal(codePart?.background, '#F0F0F0');
    assert.equal(codePart?.fontSize, 11);
  });

  it('converts repeater child field with nested column layout to pdfmake columns', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';

    const wrap = document.createElement('div');
    wrap.className = 'preview-document__section-wrap';
    const body = document.createElement('div');
    body.className = 'preview-document__section document-section__body';
    body.appendChild(buildRepeaterWithColumnsDom('city', 'milan'));
    wrap.appendChild(body);
    root.appendChild(wrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const columnNodes = findPdfColumnNodes(content);
    assert.ok(columnNodes.length >= 1, 'expected pdfmake columns block from nested repeater preview');

    const columnBlock = columnNodes[0] as any;
    assert.equal(columnBlock.columns.length, 2);
    const leftText = nodeTextJoined(columnBlock.columns[0]);
    const rightText = nodeTextJoined(columnBlock.columns[1]);
    assert.match(leftText, /city/);
    assert.match(rightText, /milan/);
    assert.doesNotMatch(leftText, /milan/);
  });

  it('exports root-level preview-document__block with child field line content', () => {
    const root = document.createElement('div');
    root.className = 'preview-document';

    const block = document.createElement('div');
    block.className = 'preview-document__block';
    const line = document.createElement('div');
    line.className = 'preview-document__line';
    const label = document.createElement('span');
    label.textContent = 'address: ';
    line.appendChild(label);
    line.appendChild(buildRepeaterWithColumnsDom('city', 'milan'));
    block.appendChild(line);
    root.appendChild(block);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const text = content.map((node) => nodeTextJoined(node)).join('\n');
    assert.match(text, /address:/);
    assert.match(text, /city/);
    assert.match(text, /milan/);
    const columnNodes = findPdfColumnNodes(content);
    assert.ok(columnNodes.length >= 1);
  });

  it('skips CSS-hidden empty field tokens when hide-empty preview class is set', () => {
    const root = document.createElement('div');
    root.className = 'preview-document preview-document--hide-empty';

    const wrap = document.createElement('div');
    wrap.className = 'preview-document__section-wrap';
    const body = document.createElement('div');
    body.className = 'preview-document__section document-section__body';
    body.innerHTML = [
      '<span class="field-token field-token--preview">visible</span>',
      '<span class="field-token field-token--preview field-token--empty">hidden empty</span>',
    ].join('');
    wrap.appendChild(body);
    root.appendChild(wrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const text = nodeTextJoined(content[0]);
    assert.match(text, /visible/);
    assert.doesNotMatch(text, /hidden empty/);
  });

  it('keeps required-missing empty placeholders when hide-empty preview class is set', () => {
    const root = document.createElement('div');
    root.className = 'preview-document preview-document--hide-empty';

    const wrap = document.createElement('div');
    wrap.className = 'preview-document__section-wrap';
    const body = document.createElement('div');
    body.className = 'preview-document__section document-section__body';
    body.innerHTML = [
      'Orbit: ',
      '<span class="field-token field-token--preview field-token--empty field-token--required-missing">OD</span>',
      '<span class="field-token field-token--preview field-token--empty">OS</span>',
    ].join('');
    wrap.appendChild(body);
    root.appendChild(wrap);

    const content = previewDomToPdfContent(root, {
      resolveFontName: fontRegistry.resolveFontName,
      defaultFont: fontRegistry.defaultFont,
      baseFontSize: 12,
    });

    const text = nodeTextJoined(content[0]);
    assert.match(text, /Orbit:/);
    assert.match(text, /OD/);
    assert.doesNotMatch(text, /\bOS\b/);
  });
});
