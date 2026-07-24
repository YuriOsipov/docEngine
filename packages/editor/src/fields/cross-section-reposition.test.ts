// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectRemappableEntries,
  remapFieldIdOnDom,
  remapFieldIdInRegistry,
  moveFieldToSectionInFormulas,
  remapperMovedSubtreeToSection,
} from './cross-section-reposition.js';

function makeToken({ fieldId, cell = false, tableId = null, rowKey = null, colKey = null } = {}) {
  const el = {
    classList: {
      contains(name) {
        if (name === 'field-token') return true;
        if (name === 'field-token--cell') return cell;
        return false;
      },
    },
    dataset: { fieldId },
    querySelectorAll() {
      return [];
    },
  };
  if (tableId) el.dataset.tableId = tableId;
  if (rowKey) el.dataset.rowKey = rowKey;
  if (colKey) el.dataset.colKey = colKey;
  return el;
}

function makeTable({ tableId, cells = [] } = {}) {
  return {
    classList: {
      contains(name) {
        return name === 'document-table';
      },
    },
    dataset: { tableId },
    querySelectorAll(selector) {
      if (selector === '.field-token--cell') return cells;
      return [];
    },
  };
}

function makeColumns({ fields = [], tables = [] } = {}) {
  return {
    classList: {
      contains(name) {
        return name === 'document-columns';
      },
    },
    querySelectorAll(selector) {
      if (selector === '.field-token:not(.field-token--cell)') return fields;
      if (selector === '.document-table') return tables;
      return [];
    },
  };
}

describe('collectRemappableEntries', () => {
  it('collects a plain field token', () => {
    const token = makeToken({ fieldId: 'anamnesis_complaints' });
    assert.deepEqual(
      collectRemappableEntries(token).map((e) => ({ kind: e.kind, id: e.id })),
      [{ kind: 'field', id: 'anamnesis_complaints' }],
    );
  });

  it('skips table cell tokens', () => {
    const token = makeToken({ fieldId: 'tbl_r1_c1', cell: true, tableId: 'tbl' });
    assert.equal(collectRemappableEntries(token).length, 0);
  });

  it('collects fields and tables inside columns', () => {
    const field = makeToken({ fieldId: 'anamnesis_note' });
    const table = makeTable({ tableId: 'anamnesis_grid' });
    const columns = makeColumns({ fields: [field], tables: [table] });
    assert.deepEqual(
      collectRemappableEntries(columns).map((e) => ({ kind: e.kind, id: e.id })),
      [
        { kind: 'field', id: 'anamnesis_note' },
        { kind: 'table', id: 'anamnesis_grid' },
      ],
    );
  });
});

describe('remapFieldIdOnDom', () => {
  it('updates table id and nested cell ids', () => {
    const cell = makeToken({
      fieldId: 'anamnesis_grid_r1_od',
      cell: true,
      tableId: 'anamnesis_grid',
    });
    const table = makeTable({ tableId: 'anamnesis_grid', cells: [cell] });
    remapFieldIdOnDom({ kind: 'table', id: 'anamnesis_grid', el: table }, 'anamnesis_grid', 'exam_grid');
    assert.equal(table.dataset.tableId, 'exam_grid');
    assert.equal(cell.dataset.tableId, 'exam_grid');
    assert.equal(cell.dataset.fieldId, 'exam_grid_r1_od');
  });
});

describe('remapFieldIdInRegistry', () => {
  it('moves schema and table cell schemas to the new id', () => {
    let schemas = {
      anamnesis_grid: { type: 'table', name: 'Grid', columns: [{ key: 'od' }] },
      anamnesis_grid_r1_od: { type: 'text', name: 'OD' },
      other_computed: { type: 'computed', formula: '{anamnesis_grid_r1_od}' },
    };
    const registry = {
      getFieldSchemas: () => schemas,
      setFieldSchemas(next) {
        schemas = next;
      },
    };

    remapFieldIdInRegistry(registry, 'anamnesis_grid', 'exam_grid', schemas.anamnesis_grid);

    assert.equal(schemas.anamnesis_grid, undefined);
    assert.equal(schemas.exam_grid?.name, 'Grid');
    assert.equal(schemas.anamnesis_grid_r1_od, undefined);
    assert.equal(schemas.exam_grid_r1_od?.name, 'OD');
    assert.equal(schemas.other_computed.formula, '{exam_grid_r1_od}');
  });
});

describe('moveFieldToSectionInFormulas', () => {
  it('rewrites section path for scalar and table column refs', () => {
    const schemas = {
      c1: {
        type: 'computed',
        formula: '{Anamnesis.Complaints} + {Anamnesis.Grid.OD}',
      },
    };
    const next = moveFieldToSectionInFormulas(schemas, 'Anamnesis', 'Examination', 'Complaints');
    assert.equal(next.c1.formula, '{Examination.Complaints} + {Anamnesis.Grid.OD}');

    const nextTable = moveFieldToSectionInFormulas(schemas, 'Anamnesis', 'Examination', 'Grid');
    assert.equal(nextTable.c1.formula, '{Anamnesis.Complaints} + {Examination.Grid.OD}');
  });
});

describe('remapperMovedSubtreeToSection', () => {
  it('reallocates field ids into the target section', () => {
    const token = makeToken({ fieldId: 'anamnesis_complaints' });
    let schemas = {
      anamnesis_complaints: { type: 'text', name: 'Complaints', label: 'Complaints' },
      c1: { type: 'computed', formula: '{Anamnesis.Complaints}' },
    };
    const registry = {
      getFieldSchemas: () => schemas,
      setFieldSchemas(next) {
        schemas = next;
      },
      updateFieldSchema(id, schema) {
        schemas = { ...schemas, [id]: schema };
      },
    };

    const sourceSection = {
      dataset: { sectionName: 'Anamnesis' },
      querySelector() {
        return null;
      },
    };
    const targetSection = {
      dataset: { sectionName: 'Examination' },
      querySelector() {
        return null;
      },
    };
    const sourceBody = {
      closest(selector) {
        return selector === '.document-section' ? sourceSection : null;
      },
    };
    const targetBody = {
      closest(selector) {
        if (selector === '.document-section') return targetSection;
        if (selector === '[data-doc-editor]') return holder;
        return null;
      },
      querySelectorAll() {
        return [];
      },
    };
    const holder = {
      querySelectorAll(selector) {
        if (selector === '.document-section__body') return [targetBody];
        return [];
      },
    };

    const changed = remapperMovedSubtreeToSection(token, targetBody, sourceBody, {
      getRegistry: () => registry,
    });

    assert.equal(changed, true);
    assert.equal(token.dataset.fieldId, 'examination_complaints');
    assert.equal(schemas.anamnesis_complaints, undefined);
    assert.equal(schemas.examination_complaints?.name, 'Complaints');
    assert.equal(schemas.c1.formula, '{Examination.Complaints}');
  });
});
