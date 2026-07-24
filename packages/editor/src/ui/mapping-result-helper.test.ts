import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { parseHTML } from 'linkedom';
import { getSourceFieldsAtPath } from '@docengine/engine';
import {
  findPathTokenAtCursor,
  findMappingResultSelection,
  findMappingResultFieldKeyRange,
  findMappingResultIssueRanges,
  buildMappingResultHighlightHtml,
  getMappingResultLeafKey,
  getPathInsertRange,
  insertPathSegmentAtCursor,
  resolveAutocompleteLookup,
} from './mapping-result-helper.js';
function patchTextarea(textarea: any) {
  if (textarea.setRangeText) return textarea;
  textarea.setRangeText = function setRangeText(replacement: any,start: any,end: any,selectMode: any) {
    const value = this.value;
    this.value = value.slice(0, start) + replacement + value.slice(end);
    const next = start + replacement.length;
    this.selectionStart = selectMode === 'end' ? next : start;
    this.selectionEnd = next;
  };
  return textarea;
}

describe('mapping-result-helper', () => {
  beforeEach(() => {
    const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
    globalThis.document = document;
  });

  it('findPathTokenAtCursor locates partial path before cursor', () => {
    const value = '"city": "$payload.se';
    const token = findPathTokenAtCursor(value, value.length);
    assert.deepEqual(token, { start: 9, end: 20, prefix: '$payload.se' });
  });

  it('insertPathSegmentAtCursor completes only the current segment', () => {
    const textarea = patchTextarea(document.createElement('textarea'));
    textarea.dispatchEvent = () => true;
    textarea.value = '"city": "$payload.sections.he';
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;

    insertPathSegmentAtCursor(textarea, {
      key: 'header',
      path: '$payload.sections.header',
      type: 'object',
    });

    assert.strictEqual(textarea.value, '"city": "$payload.sections.header');
  });

  it('resolveAutocompleteLookup drills into completed object segment without trailing dot', () => {
    const payload = {
      sections: {
        header: { Text: 'hello' },
        items: { Table: [{ name: 'A', amount: '1' }] },
      },
    };
    const value = '"city": "$payload.sections.items.Table"';
    const cursor = value.length - 1;

    const resolved = resolveAutocompleteLookup(payload, value, cursor);
    assert.ok(resolved);
    assert.strictEqual(resolved.lookupPrefix, '$payload.sections.items.Table.');

    const fields = getSourceFieldsAtPath(payload, resolved.lookupPrefix);
    assert.ok(fields.some((field: any) => field.key === 'name'));
    assert.ok(fields.some((field: any) => field.key === 'amount'));
  });

  it('resolveAutocompleteLookup keeps partial segment for filtering', () => {
    const payload = { sections: { header: { Text: 'hello' } } };
    const value = '"city": "$payload.sections.he';
    const cursor = value.length;

    const resolved = resolveAutocompleteLookup(payload, value, cursor);
    assert.ok(resolved);
    assert.strictEqual(resolved.lookupPrefix, '$payload.sections.he');
  });

  it('insertPathSegmentAtCursor replaces selected range', () => {
    const textarea = patchTextarea(document.createElement('textarea'));
    textarea.value = '"city": "$payload.old"';
    textarea.selectionStart = 9;
    textarea.selectionEnd = 21;

    const range = getPathInsertRange(textarea);
    assert.deepEqual(range, { start: 9, end: 21, prefix: '$payload.old' });
  });

  it('getMappingResultLeafKey prefers column and child path tails', () => {
    assert.equal(getMappingResultLeafKey({ field: 'Table', columnKey: 'vis', sourcePath: '$a' }), 'vis');
    assert.equal(
      getMappingResultLeafKey({ field: 'Address', childFieldPath: 'City.Name', sourcePath: '$a' }),
      'Name',
    );
    assert.equal(getMappingResultLeafKey({ field: 'Complaints', sourcePath: '$a' }), 'Complaints');
  });

  it('findMappingResultSelection locates keyed source path in result JSON', () => {
    const text = JSON.stringify(
      {
        kind: 'field',
        version: 1,
        sections: {
          Anamnesis: {
            Complaints: '$payload.sections.anamnesis.complaints',
          },
        },
      },
      null,
      2,
    );
    const range = findMappingResultSelection(text, {
      section: 'Anamnesis',
      field: 'Complaints',
      sourcePath: '$payload.sections.anamnesis.complaints',
    });
    assert.ok(range);
    assert.equal(
      text.slice(range.start, range.end),
      '"$payload.sections.anamnesis.complaints"',
    );
  });

  it('findMappingResultFieldKeyRange highlights unknown field keys', () => {
    const text = JSON.stringify(
      {
        kind: 'field',
        version: 2,
        sections: {
          Anamnesis: {
            Complaints2: '$payload.sections.Untitled.Text_2',
          },
        },
      },
      null,
      2,
    );
    const range = findMappingResultFieldKeyRange(text, {
      section: 'Anamnesis',
      field: 'Complaints2',
      message: 'Unknown template field "Complaints2" in section "Anamnesis".',
    });
    assert.ok(range);
    assert.equal(text.slice(range.start, range.end), '"Complaints2"');
  });

  it('findMappingResultIssueRanges highlights missing source paths', () => {
    const text = JSON.stringify(
      {
        kind: 'field',
        version: 2,
        sections: {
          Anamnesis: {
            Complaints: '$payload.sections.Untitled.TT',
          },
        },
      },
      null,
      2,
    );
    const ranges = findMappingResultIssueRanges(text, [
      {
        section: 'Anamnesis',
        field: 'Complaints',
        sourcePath: '$payload.sections.Untitled.TT',
        severity: 'warning',
        message: 'Source path "$payload.sections.Untitled.TT" does not exist in the payload.',
      },
    ]);
    assert.equal(ranges.length, 1);
    assert.equal(text.slice(ranges[0].start, ranges[0].end), '"$payload.sections.Untitled.TT"');
  });

  it('buildMappingResultHighlightHtml wraps issue ranges in mark tags', () => {
    const text = '{\n  "Complaints2": "$x"\n}';
    const ranges = findMappingResultIssueRanges(text, [
      { section: 'Anamnesis', field: 'Complaints2', severity: 'warning', message: 'Unknown' },
    ]);
    assert.equal(ranges.length, 1);
    const html = buildMappingResultHighlightHtml(text, ranges);
    assert.match(html, /field-mapping-result-highlight__mark--warning/);
    assert.match(html, /&quot;Complaints2&quot;/);
  });
});
