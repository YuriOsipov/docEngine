// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildFormulaFieldTree,
  extractFormulaDependencyFieldIds,
  formatFormulaReference,
  parseFormulaReferenceSegments,
  resolveFormulaReference,
  renameFieldNameInFormulas,
} from './formula-field-index.js';
import { cellFieldId, ensureCellSchemasForRows } from './field-schemas.js';

const sectionBlocks = [
  {
    type: 'documentSection',
    data: {
      name: 'Examination',
      label: 'Examination',
      segments: [
        { type: 'field', id: 'examination_weight' },
        { type: 'table', id: 'examination_labs' },
        { type: 'field', id: 'examination_total' },
      ],
    },
  },
];

const fieldSchemas = {
  examination_weight: { type: 'integer', name: 'Weight', label: 'Weight' },
  examination_labs: {
    type: 'table',
    name: 'Labs',
    label: 'Labs',
    columns: [
      { key: 'glucose', label: 'Glucose', name: 'Glucose' },
      { key: 'count', label: 'Count', name: 'Count' },
    ],
    rows: [
      { key: 'row1', label: 'Row 1' },
      { key: 'row2', label: 'Row 2' },
    ],
  },
  examination_total: { type: 'computed', name: 'Total', label: 'Total', formula: '' },
};

const schemasWithCells = ensureCellSchemasForRows(
  fieldSchemas.examination_labs,
  'examination_labs',
  fieldSchemas,
  fieldSchemas.examination_labs.rows,
);

describe('parseFormulaReferenceSegments', () => {
  it('parses simple dot paths', () => {
    assert.deepEqual(parseFormulaReferenceSegments('Examination.Weight'), [
      'Examination',
      'Weight',
    ]);
  });

  it('parses quoted segments', () => {
    assert.deepEqual(parseFormulaReferenceSegments('Examination."My.Field"'), [
      'Examination',
      'My.Field',
    ]);
  });
});

describe('formatFormulaReference', () => {
  it('quotes segments with dots', () => {
    assert.equal(formatFormulaReference(['Examination', 'My.Field']), 'Examination."My.Field"');
  });
});

describe('resolveFormulaReference', () => {
  it('resolves scalar dot paths', () => {
    const resolved = resolveFormulaReference('Examination.Weight', sectionBlocks, schemasWithCells);
    assert.deepEqual(resolved, { kind: 'scalar', fieldId: 'examination_weight' });
  });

  it('resolves legacy field ids', () => {
    const resolved = resolveFormulaReference('examination_weight', sectionBlocks, schemasWithCells);
    assert.deepEqual(resolved, { kind: 'scalar', fieldId: 'examination_weight' });
  });

  it('resolves table column paths', () => {
    const resolved = resolveFormulaReference(
      'Examination.Labs.Glucose',
      sectionBlocks,
      schemasWithCells,
    );
    assert.equal(resolved?.kind, 'column');
    assert.equal(resolved.tableId, 'examination_labs');
    assert.equal(resolved.colKey, 'glucose');
    assert.equal(resolved.cellIds.length, 2);
  });
});

describe('extractFormulaDependencyFieldIds', () => {
  it('includes all column cell ids', () => {
    const formula = 'sum({Examination.Labs.Glucose})';
    const deps = extractFormulaDependencyFieldIds(formula, sectionBlocks, schemasWithCells);
    assert.ok(deps.includes(cellFieldId('examination_labs', 'row1', 'glucose')));
    assert.ok(deps.includes(cellFieldId('examination_labs', 'row2', 'glucose')));
  });
});

describe('buildFormulaFieldTree', () => {
  it('builds section field and column nodes', () => {
    const tree = buildFormulaFieldTree(sectionBlocks, schemasWithCells, {
      excludeFieldId: 'examination_total',
    });
    assert.equal(tree.length, 1);
    assert.equal(tree[0].label, 'Examination');
    const weight = tree[0].children?.find((node) => node.label === 'Weight');
    assert.equal(weight?.path, 'Examination.Weight');
    const labs = tree[0].children?.find((node) => node.label === 'Labs');
    assert.equal(labs?.children?.length, 2);
  });
});

describe('renameFieldNameInFormulas', () => {
  it('updates dot-path references', () => {
    const schemas = {
      ...schemasWithCells,
      examination_total: {
        type: 'computed',
        name: 'Total',
        label: 'Total',
        formula: '{Examination.Weight} + 1',
      },
    };
    const next = renameFieldNameInFormulas(schemas, 'Examination', 'Weight', 'Body weight');
    assert.equal(
      next.examination_total.formula,
      '{Examination.Body weight} + 1',
    );
  });
});
