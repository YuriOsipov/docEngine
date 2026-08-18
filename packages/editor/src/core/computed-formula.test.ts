// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  evaluateFormula,
  evaluateComputedField,
  registerFormulaFunction,
  resetFormulaFunctions,
} from './computed-formula.js';
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

describe('table-cell computed formulas', () => {
  it('evaluates same-row column references for computed table cells', () => {
    const tableId = 'products_line_items';
    const rows = [
      { key: 'r1', label: 'R1' },
      { key: 'r2', label: 'R2' },
    ];
    const schema = {
      type: 'table',
      name: 'Line Items',
      label: 'Line Items',
      columns: [
        { key: 'quantity', label: 'Quantity', name: 'Quantity' },
        { key: 'unit_price', label: 'Unit Price', name: 'Unit Price' },
        { key: 'total', label: 'Total', name: 'Total' },
      ],
      rows,
    };
    const blocksForTable = [
      {
        type: 'documentSection',
        data: {
          name: 'Products',
          segments: [{ type: 'table', id: tableId }],
        },
      },
    ];
    const schemas = ensureCellSchemasForRows(
      schema,
      tableId,
      { [tableId]: schema },
      rows,
    );
    schemas[cellFieldId(tableId, 'r1', 'total')] = {
      ...schemas[cellFieldId(tableId, 'r1', 'total')],
      type: 'computed',
      formula: '{Products.Line Items.Quantity} * {Products.Line Items.Unit Price}',
    };
    schemas[cellFieldId(tableId, 'r2', 'total')] = {
      ...schemas[cellFieldId(tableId, 'r2', 'total')],
      type: 'computed',
      formula: '{Products.Line Items.Quantity} * {Products.Line Items.Unit Price}',
    };
    const rowValues = {
      [cellFieldId(tableId, 'r1', 'quantity')]: '2',
      [cellFieldId(tableId, 'r1', 'unit_price')]: '100',
      [cellFieldId(tableId, 'r2', 'quantity')]: '3',
      [cellFieldId(tableId, 'r2', 'unit_price')]: '50',
    };

    const r1 = evaluateComputedField(
      cellFieldId(tableId, 'r1', 'total'),
      rowValues,
      schemas,
      { blocks: blocksForTable as any },
    );
    const r2 = evaluateComputedField(
      cellFieldId(tableId, 'r2', 'total'),
      rowValues,
      schemas,
      { blocks: blocksForTable as any },
    );

    assert.equal(r1.error, null);
    assert.equal(r1.value, '200');
    assert.equal(r2.error, null);
    assert.equal(r2.value, '150');
  });

  it('allows aggregate totals to sum computed row totals', () => {
    const tableId = 'products_line_items';
    const rows = [
      { key: 'r1', label: 'R1' },
      { key: 'r2', label: 'R2' },
      { key: 'r3', label: 'R3' },
    ];
    const schema = {
      type: 'table',
      name: 'Line Items',
      label: 'Line Items',
      columns: [
        { key: 'quantity', label: 'Quantity', name: 'Quantity' },
        { key: 'unitPrice', label: 'Unit Price', name: 'Unit Price' },
        { key: 'total', label: 'Total', name: 'Total' },
      ],
      rows,
    };
    const blocksForTable = [
      {
        type: 'documentSection',
        data: {
          name: 'Products',
          segments: [{ type: 'table', id: tableId }],
        },
      },
      {
        type: 'documentSection',
        data: {
          name: 'Totals',
          segments: [{ type: 'field', id: 'totals_sub_total' }],
        },
      },
    ];
    const schemas = ensureCellSchemasForRows(
      schema,
      tableId,
      {
        [tableId]: schema,
        totals_sub_total: {
          type: 'computed',
          formula: 'sum({Products.Line Items.Total})',
        },
      },
      rows,
    );
    for (const row of rows) {
      const totalId = cellFieldId(tableId, row.key, 'total');
      schemas[totalId] = {
        ...schemas[totalId],
        type: 'computed',
        formula: '{Products.Line Items.Quantity} * {Products.Line Items.Unit Price}',
      };
    }
    const rowValues = {
      [cellFieldId(tableId, 'r1', 'quantity')]: '2',
      [cellFieldId(tableId, 'r1', 'unitPrice')]: '1000',
      [cellFieldId(tableId, 'r2', 'quantity')]: '3',
      [cellFieldId(tableId, 'r2', 'unitPrice')]: '1000',
      [cellFieldId(tableId, 'r3', 'quantity')]: '1',
      [cellFieldId(tableId, 'r3', 'unitPrice')]: '500',
    };

    const subtotal = evaluateComputedField(
      'totals_sub_total',
      rowValues,
      schemas,
      { blocks: blocksForTable as any },
    );
    assert.equal(subtotal.error, null);
    assert.equal(subtotal.value, '5500');
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
