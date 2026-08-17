// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateFormula, registerFormulaFunction, resetFormulaFunctions } from './computed-formula.js';
import { cellFieldId, ensureCellSchemasForRows } from './field-schemas.js';

const blocks = [
  {
    type: 'documentSection',
    data: {
      name: 'Examination',
      segments: [
        { type: 'field', id: 'examination_weight' },
        { type: 'table', id: 'examination_labs' },
      ],
    },
  },
];

const tableSchema = {
  type: 'table',
  name: 'Labs',
  label: 'Labs',
  columns: [{ key: 'value', label: 'Value', name: 'Value' }],
  rows: [
    { key: 'row1', label: 'Row 1' },
    { key: 'row2', label: 'Row 2' },
  ],
};

const fieldSchemas = ensureCellSchemasForRows(
  tableSchema,
  'examination_labs',
  {
    examination_weight: { type: 'integer', name: 'Weight', label: 'Weight' },
    examination_labs: tableSchema,
  },
  tableSchema.rows,
);

const values = {
  examination_weight: '10',
  [cellFieldId('examination_labs', 'row1', 'value')]: '2',
  [cellFieldId('examination_labs', 'row2', 'value')]: '4',
};

describe('evaluateFormula dot paths', () => {
  it('evaluates scalar dot-path references', () => {
    const result = evaluateFormula('{Examination.Weight} + 5', values, fieldSchemas, { blocks });
    assert.equal(result.value, '15');
    assert.equal(result.error, null);
  });

  it('keeps legacy field id references', () => {
    const result = evaluateFormula('{examination_weight} * 2', values, fieldSchemas, { blocks });
    assert.equal(result.value, '20');
  });

  it('joins bare column references', () => {
    const result = evaluateFormula('{Examination.Labs.Value}', values, fieldSchemas, { blocks });
    assert.equal(result.value, '2; 4');
  });
});

describe('evaluateFormula aggregates', () => {
  it('sums a table column', () => {
    const result = evaluateFormula('sum({Examination.Labs.Value})', values, fieldSchemas, {
      blocks,
    });
    assert.equal(result.value, '6');
  });

  it('counts non-empty column values', () => {
    const result = evaluateFormula('count({Examination.Labs.Value})', values, fieldSchemas, {
      blocks,
    });
    assert.equal(result.value, '2');
  });

  it('supports quoted path segments', () => {
    const schemas = {
      ...fieldSchemas,
      examination_weight: { type: 'integer', name: 'My.Weight', label: 'My.Weight' },
    };
    const result = evaluateFormula(
      '{Examination."My.Weight"}',
      { ...values, examination_weight: '7' },
      schemas,
      { blocks },
    );
    assert.equal(result.value, '7');
  });
});

describe('evaluateFormula plugin functions', () => {
  it('evaluates a registered function', () => {
    registerFormulaFunction({
      name: 'round',
      arity: 1,
      impl: ([value]) => Math.round(Number(value)),
    });
    try {
      const result = evaluateFormula('round(2.6)', {}, {});
      assert.equal(result.error, null);
      assert.equal(result.value, '3');
    } finally {
      resetFormulaFunctions();
    }
  });
});
