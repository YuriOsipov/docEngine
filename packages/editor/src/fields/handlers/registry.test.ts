import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import {
  registerField,
  unregisterField,
  getFieldHandler,
  hasFieldHandler,
  getFieldTypes,
  getInlineFieldTypes,
  isInlineFieldType,
  listFieldHandlers as _listFieldHandlers,
  registerBuiltinFields,
} from './index.js';
import { createDefaultSchema, resolveSchemaDefaultValue, isFieldEditableInFillMode } from '../../core/field-schemas.js';
import { schemaToDisplayConfig, SchemaRegistry } from '../../registry/schema-registry.js';
import { createCatalogProvider } from '../../catalog/catalog-provider.js';
import { formatFieldDisplay, isFieldEmpty } from '../inline-fields.js';
import { dateFieldHandler } from '@docengine/field-date';
import { formatNumericDisplay } from '@docengine/engine';

describe('field handler registry', () => {
  before(() => {
    registerBuiltinFields();
    registerField(dateFieldHandler);
  });

  after(() => {
    unregisterField('date');
    unregisterField('__test_score__');
  });

  it('registers built-in field types without date (date is a host plugin)', () => {
    unregisterField('date');
    const types = getFieldTypes().map((t: any) => t.type);
    assert.deepEqual(types, [
      'text',
      'integer',
      'computed',
      'image',
      'list',
      'choice',
      'tree',
      'table',
      'child',
    ]);
    assert.equal(hasFieldHandler('date'), false);
    registerField(dateFieldHandler);
  });

  it('marks table as non-inline insertion', () => {
    assert.equal(isInlineFieldType('text'), true);
    assert.equal(isInlineFieldType('child'), true);
    assert.equal(isInlineFieldType('table'), false);
    assert.ok(!getInlineFieldTypes().includes('table'));
    assert.equal(getFieldHandler('table')?.insertion, 'table');
  });

  it('createDefaultSchema uses handlers', () => {
    const text = createDefaultSchema('text', 'Notes');
    assert.equal(text.type, 'text');
    assert.equal(text.defaultText, '');

    const table = createDefaultSchema('table', 'Grid');
    assert.equal(table.type, 'table');
    assert.equal(table.columns.length, 2);
    assert.equal(table.columns[0].key, 'column_1');
  });

  it('resolveSchemaDefaultValue uses handlers', () => {
    assert.equal(resolveSchemaDefaultValue({ type: 'text', defaultText: 'hi' }), 'hi');
    assert.deepEqual(resolveSchemaDefaultValue({ type: 'list', defaultValue: ['a'] }), ['a']);
    assert.equal(
      isFieldEditableInFillMode({ type: 'computed', label: 'C', name: 'C', formula: '' }),
      false,
    );
  });

  it('schemaToDisplayConfig / picker config use handlers', () => {
    const display = schemaToDisplayConfig({ type: 'integer', label: 'Age', suffix: 'y' });
    assert.equal(display.picker, 'integer');
    assert.equal(display.suffix, 'y');

    const registry = new SchemaRegistry(createCatalogProvider());
    const picker = registry.schemaToPickerConfig({
      type: 'choice',
      label: 'Eye',
      items: [{ id: 'od', label: 'OD' }],
    });
    assert.equal(picker.picker, 'list');
    assert.equal(picker.schemaType, 'choice');
    assert.equal(picker.items.length, 1);
  });

  it('host can plug in date via @docengine/field-date', () => {
    const date = getFieldHandler('date');
    assert.equal(date?.type, 'date');
    assert.equal(date?.label, 'Date');
    assert.ok(getFieldTypes().some((t: any) => t.type === 'date'));
    assert.equal(createDefaultSchema('date', 'Document').type, 'date');
    assert.equal(
      formatFieldDisplay('when', '2024-01-02', 'When', {
        fieldSchemas: { when: { type: 'date', label: 'When', name: 'When', dateFormat: 'iso' } },
      }),
      '2024-01-02',
    );
    assert.equal(isFieldEmpty('', { schema: { type: 'date' } }), true);
  });

  it('formatDisplay / isEmpty use field handlers', () => {
    const ctx = {
      fieldSchemas: {
        age: { type: 'integer', label: 'Age', name: 'Age', suffix: 'y' },
        total: {
          type: 'integer',
          label: 'Total',
          name: 'Total',
          displayFormat: 'currency',
          currencyCode: 'EUR',
          fractionDigits: 2,
        },
      },
    };
    assert.equal(formatFieldDisplay('age', '42', 'Age', ctx), '42y');
    assert.equal(
      formatFieldDisplay('total', '1234.5', 'Total', ctx),
      formatNumericDisplay(1234.5, {
        displayFormat: 'currency',
        currencyCode: 'EUR',
        fractionDigits: 2,
      }),
    );
    assert.equal(getFieldHandler('text')?.pdfRenderMode?.({ htmlEditor: true }), 'html');
  });

  it('allows registering a host field plugin', () => {
    registerField({
      type: '__test_score__',
      label: 'Score',
      paletteOrder: 55,
      createSchema(label: any, name: any) {
        return { type: '__test_score__', label, name, required: false, max: 10 };
      },
      getEmptyValue: () => '',
      resolveDefaultValue: () => '',
      toDisplayConfig: (schema: any) => ({ picker: 'integer', label: schema.label }),
      toPickerConfig: (schema: any) => ({
        picker: 'integer',
        label: schema.label,
        min: 0,
        max: schema.max ?? 10,
      }),
      formatDisplay: (value: any, { emptyLabel, schema }: any) =>
        value == null || value === '' ? emptyLabel : `${value}/${schema.max ?? 10}`,
      pdfRenderMode: () => 'plain',
    });

    assert.equal(hasFieldHandler('__test_score__'), true);
    assert.ok(getFieldTypes().some((t: any) => t.type === '__test_score__'));
    assert.equal(createDefaultSchema('__test_score__', 'Score').max, 10);
    assert.equal(isInlineFieldType('__test_score__'), true);
    assert.equal(
      formatFieldDisplay('s', '7', 'Score', {
        fieldSchemas: { s: { type: '__test_score__', label: 'Score', name: 'Score', max: 10 } },
      }),
      '7/10',
    );

    unregisterField('__test_score__');
    assert.equal(hasFieldHandler('__test_score__'), false);
  });
});
