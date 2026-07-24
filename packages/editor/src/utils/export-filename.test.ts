import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildExportFilename,
  formatFilenameTimestamp,
  slugifyFilename,
} from './export-filename.js';

describe('slugifyFilename', () => {
  it('replaces unsafe characters and collapses underscores', () => {
    assert.equal(slugifyFilename('Ophthalmology Examination'), 'Ophthalmology_Examination');
    assert.equal(slugifyFilename('  a / b : c  '), 'a_b_c');
  });

  it('falls back to document for empty input', () => {
    assert.equal(slugifyFilename(''), 'document');
    assert.equal(slugifyFilename('***'), 'document');
  });
});

describe('buildExportFilename', () => {
  it('builds unique html and pdf names', () => {
    const now = new Date(2026, 6, 23, 9, 34, 5);
    const html = buildExportFilename({
      title: 'Ophthalmology Examination',
      format: 'html',
      now,
      id: 'a3f9c2',
    });
    assert.equal(html, 'Ophthalmology_Examination_20260723-093405_a3f9c2.html');

    const pdf = buildExportFilename({
      title: 'Ophthalmology Examination',
      format: 'pdf',
      now,
      id: 'a3f9c2',
    });
    assert.equal(pdf, 'Ophthalmology_Examination_20260723-093405_a3f9c2.pdf');
  });

  it('respects unique: false and strips existing extension from baseName', () => {
    assert.equal(
      buildExportFilename({ baseName: 'report.pdf', format: 'html', unique: false }),
      'report.html',
    );
  });
});

describe('formatFilenameTimestamp', () => {
  it('formats local date parts', () => {
    const now = new Date(2026, 0, 5, 3, 4, 7);
    assert.equal(formatFilenameTimestamp(now), '20260105-030407');
  });
});
