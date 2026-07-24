// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createEmptyRepeaterValue,
  normalizeRepeaterValue,
  repeaterHasContent,
  buildRepeaterPreviewDocument,
  buildRepeaterFillDocument,
  buildRepeaterTemplateDocument,
  extractRepeaterFieldSchemasFromDocument,
  extractRepeaterValueFromDocument,
  buildRepeaterTemplateExport,
  parseRepeaterTemplateImport,
  applyRepeaterTemplateImport,
  syncRepeaterTemplateFromFillDocument,
  normalizeRepeaterSchema,
  sanitizeRepeaterChildSchemas,
  ensureRepeaterChildSchemas,
  inferRepeaterChildSchemasFromValue,
  ensureRepeaterSchemasFromBlockValues,
  stripForeignKeysFromRepeaterValue,
  namespaceRepeaterChildTemplate,
  repeaterChildNamespacePrefix,
  repeaterHasTemplate,
  getRepeaterFieldSchemas,
  mergeRepeaterDomValues,
  editorIdToRepeaterStorageKey,
  isLegacyRepeaterInstancesWrapper,
  REPEATER_TEMPLATE_FILE_KIND,
} from './repeater-io.js';

describe('repeater-io', () => {
  const sharedFieldSchemas = {
    street: { type: 'text', label: 'Street', name: 'Street' },
    city: { type: 'text', label: 'City', name: 'City' },
  };

  const shippingSchema = {
    type: 'child',
    label: 'Shipping address',
    name: 'shippingAddress',
    fieldSchemas: sharedFieldSchemas,
  };

  it('creates empty flat value', () => {
    const value = createEmptyRepeaterValue(shippingSchema);
    assert.deepEqual(value, {});
  });

  it('normalizes flat child values', () => {
    const value = normalizeRepeaterValue(
      { street: '123 Main', city: 'Boston', extra: 'ignored' },
      shippingSchema,
    );
    assert.deepEqual(value, { street: '123 Main', city: 'Boston' });
  });

  it('uses template fieldSchemas when own fieldSchemas object is empty', () => {
    const templateChild = {
      type: 'child',
      label: 'Address',
      name: 'address',
      fieldSchemas: {},
      template: {
        fieldSchemas: {
          city: { type: 'text', name: 'City', label: 'City' },
          address: { type: 'text', name: 'Address', label: 'Address' },
        },
        blocks: [
          {
            type: 'documentSection',
            data: {
              label: '',
              segments: [
                { type: 'field', id: 'city' },
                { type: 'field', id: 'address' },
              ],
              fieldValues: {},
            },
          },
        ],
      },
    };

    assert.ok(getRepeaterFieldSchemas(templateChild).city);
    assert.ok(getRepeaterFieldSchemas(templateChild).address);
    assert.strictEqual(
      repeaterHasContent({ city: 'milan', address: 'via per arogno 4' }, templateChild),
      true,
    );
    assert.deepEqual(
      normalizeRepeaterValue({ city: 'milan' }, templateChild),
      { city: 'milan' },
    );
  });

  it('detects content from raw flat values when schema keys were stripped', () => {
    const repeater = {
      type: 'child',
      label: 'Address',
      name: 'address',
      fieldSchemas: {
        postal_code: { type: 'text', name: 'Postal code', label: 'Postal code' },
      },
    };
    assert.strictEqual(
      repeaterHasContent({ city: 'milan', address: 'via per arogno 4' }, repeater),
      true,
    );
  });

  it('merges nested editor ids into repeater storage keys', () => {
    const merged = mergeRepeaterDomValues(
      {},
      {
        _repeater_city: 'milan',
        _repeater_street: 'via per arogno 4',
      },
      shippingSchema,
    );
    assert.deepEqual(merged, { city: 'milan', street: 'via per arogno 4' });
    assert.strictEqual(
      editorIdToRepeaterStorageKey('_repeater_city', shippingSchema),
      'city',
    );
  });

  it('migrates legacy instances wrapper', () => {
    const legacy = {
      instances: {
        shipping: { street: '123 Main', city: 'Boston' },
        billing: { street: '456 Oak' },
      },
    };
    assert.strictEqual(isLegacyRepeaterInstancesWrapper(legacy), true);
    const value = normalizeRepeaterValue(legacy, shippingSchema);
    assert.deepEqual(value, { street: '123 Main', city: 'Boston' });
  });

  it('detects filled flat content', () => {
    assert.strictEqual(repeaterHasContent({ street: '123 Main' }, shippingSchema), true);
    assert.strictEqual(repeaterHasContent({}, shippingSchema), false);
  });

  it('builds preview document from flat values', () => {
    const doc = buildRepeaterPreviewDocument(shippingSchema, { street: '123 Main', city: 'Boston' });
    assert.strictEqual(doc.fieldSchemas._repeater_street.label, 'Street');
    assert.strictEqual(doc.blocks[0].data.fieldValues._repeater_street, '123 Main');
    assert.strictEqual(doc.blocks[0].data.fieldValues._repeater_city, 'Boston');
  });

  it('builds and extracts template document for nested editor', () => {
    const doc = buildRepeaterTemplateDocument(shippingSchema);
    assert.strictEqual(doc.fieldSchemas._repeater_street.label, 'Street');
    assert.strictEqual(doc.blocks[0].data.segments.length, 2);

    const extracted = extractRepeaterFieldSchemasFromDocument(doc);
    assert.deepEqual(extracted, sharedFieldSchemas);
  });

  it('extracts flat values from nested editor document', () => {
    const doc = buildRepeaterPreviewDocument(shippingSchema, { street: '123 Main', city: 'Boston' });
    const value = extractRepeaterValueFromDocument(doc, shippingSchema);
    assert.deepEqual(value, { street: '123 Main', city: 'Boston' });
  });

  it('maps nested editor ids and display names to child keys', () => {
    const nestedSchema = {
      type: 'child',
      name: 'address',
      label: 'Address',
      fieldSchemas: {
        street: { type: 'text', name: 'Street', label: 'Street' },
        city: { type: 'text', name: 'City', label: 'City' },
      },
    };
    const doc = {
      fieldSchemas: {
        address_street: { type: 'text', name: 'Street', label: 'Street' },
        address_city: { type: 'text', name: 'City', label: 'City' },
      },
      blocks: [
        {
          type: 'documentSection',
          data: {
            segments: [
              { type: 'field', id: 'address_street' },
              { type: 'field', id: 'address_city' },
            ],
            fieldValues: {
              address_street: 'Arogno',
              address_city: 'Mllanoper',
            },
          },
        },
      ],
    };

    const extractedSchemas = extractRepeaterFieldSchemasFromDocument(doc);
    assert.ok(extractedSchemas.street);
    assert.ok(extractedSchemas.city);

    const value = extractRepeaterValueFromDocument(doc, nestedSchema);
    assert.deepEqual(value, { street: 'Arogno', city: 'Mllanoper' });
    assert.strictEqual(repeaterHasContent(value, nestedSchema), true);
  });

  it('normalizes child values by field name', () => {
    const value = normalizeRepeaterValue(
      { Street: 'Arogno', City: 'Mllanoper' },
      shippingSchema,
    );
    assert.deepEqual(value, { street: 'Arogno', city: 'Mllanoper' });
  });

  it('infers child schemas from flat values when template is empty', () => {
    const emptyRepeater = {
      type: 'child',
      label: 'Address',
      name: 'address',
      fieldSchemas: {},
    };
    const ensured = ensureRepeaterChildSchemas(emptyRepeater, {
      street: 'Arogno',
      city: 'Mllanoper',
      zip: '422061',
    });
    assert.ok(ensured.fieldSchemas.street);
    assert.ok(ensured.fieldSchemas.city);
    assert.ok(ensured.fieldSchemas.zip);
    assert.strictEqual(repeaterHasContent({ street: 'Arogno' }, ensured), true);
  });

  it('drops child schemas that collide with document field ids', () => {
    const polluted = {
      type: 'child',
      label: 'Address',
      name: 'address',
      fieldSchemas: {
        street: { type: 'text', name: 'Street', label: 'Street' },
        anamnesis_complaints: { type: 'tree', name: 'Complaints', label: 'Complaints' },
      },
    };
    const parentFieldSchemas = {
      anamnesis_complaints: { type: 'tree', label: 'Complaints' },
    };
    const blocks = [
      {
        type: 'documentSection',
        data: {
          segments: [{ type: 'field', id: 'anamnesis_complaints' }],
          fieldValues: {},
        },
      },
    ];
    const cleaned = sanitizeRepeaterChildSchemas(polluted, parentFieldSchemas, blocks);
    assert.deepEqual(cleaned.fieldSchemas, {
      street: { type: 'text', name: 'Street', label: 'Street' },
    });
  });

  it('drops child schemas that collide with parent registry field ids', () => {
    const repeater = {
      type: 'child',
      label: 'Address',
      name: 'address',
      fieldSchemas: {
        street: { type: 'text', name: 'Street', label: 'Street' },
        city: { type: 'text', name: 'City', label: 'City' },
        postal_code: { type: 'text', name: 'Postal code', label: 'Postal code' },
      },
    };
    const parentFieldSchemas = {
      street: { type: 'text', label: 'Unrelated street field' },
      city: { type: 'text', label: 'Unrelated city field' },
    };
    const cleaned = sanitizeRepeaterChildSchemas(repeater, parentFieldSchemas, []);
    assert.deepEqual(cleaned.fieldSchemas, {
      postal_code: { type: 'text', name: 'Postal code', label: 'Postal code' },
    });
  });

  it('strips parent document keys from repeater values but keeps storage keys', () => {
    const parentFieldSchemas = {
      anamnesis_complaints: { type: 'tree', label: 'Complaints' },
      street: { type: 'text', label: 'Street' },
    };
    const repeaterSchema = {
      type: 'child',
      fieldSchemas: {
        street: { type: 'text', name: 'Street', label: 'Street' },
        city: { type: 'text', name: 'City', label: 'City' },
      },
    };
    const cleaned = stripForeignKeysFromRepeaterValue(
      {
        anamnesis_complaints: ['Tearing'],
        street: 'Arogno',
        city: 'Milan',
      },
      parentFieldSchemas,
      repeaterSchema,
    );
    assert.deepEqual(cleaned, { street: 'Arogno', city: 'Milan' });
  });

  it('exports and imports template JSON without instances', () => {
    const exported = buildRepeaterTemplateExport(shippingSchema);
    assert.strictEqual(exported.kind, REPEATER_TEMPLATE_FILE_KIND);
    assert.strictEqual(exported.version, 3);
    assert.deepEqual(exported.fieldSchemas, sharedFieldSchemas);
    assert.strictEqual(exported.instances, undefined);

    const imported = parseRepeaterTemplateImport(exported);
    const billingSchema = {
      type: 'child',
      label: 'Billing address',
      name: 'billingAddress',
      fieldSchemas: {},
    };
    const updated = applyRepeaterTemplateImport(billingSchema, imported);
    assert.deepEqual(updated.fieldSchemas, sharedFieldSchemas);
  });

  it('normalizes legacy schema template wrapper', () => {
    const legacy = {
      type: 'child',
      label: 'Shipping address',
      name: 'shippingAddress',
      template: {
        fieldSchemas: sharedFieldSchemas,
        blocks: [],
      },
    };
    const normalized = normalizeRepeaterSchema(legacy);
    assert.deepEqual(normalized.fieldSchemas, sharedFieldSchemas);
    assert.strictEqual(normalized.template, undefined);
    assert.strictEqual(normalized.instances, undefined);
  });

  it('does not infer child schemas from parent document field ids', () => {
    const parentFieldSchemas = {
      anamnesis_complaints: { type: 'tree', label: 'Complaints' },
      examination_orbit_od: { type: 'choice', label: 'Orbit OD' },
    };
    const blocks = [
      {
        type: 'documentSection',
        data: {
          segments: [
            { type: 'field', id: 'anamnesis_complaints' },
            { type: 'field', id: 'examination_orbit_od' },
            { type: 'field', id: 'anamnesis_shippingAddress' },
          ],
          fieldValues: {},
        },
      },
    ];
    const polluted = {
      anamnesis_complaints: ['Tearing'],
      examination_orbit_od: 'norm',
      street: 'Arogno',
      city: 'Milan',
    };
    const inferred = inferRepeaterChildSchemasFromValue(
      polluted,
      { type: 'child', fieldSchemas: {} },
      parentFieldSchemas,
      blocks,
    );
    assert.deepEqual(inferred, {
      street: { type: 'text', label: 'Street', name: 'street' },
      city: { type: 'text', label: 'City', name: 'city' },
    });
  });

  it('rejects field and document template imports', () => {
    assert.throws(
      () => parseRepeaterTemplateImport({ kind: 'field', sections: {} }),
      /Use a template file/,
    );
    assert.throws(
      () => parseRepeaterTemplateImport({ kind: 'document', fieldSchemas: {}, blocks: [] }),
      /Use a template file/,
    );
  });

  it('imports kind:template editor exports with namespaced child ids', () => {
    const editorTemplate = {
      kind: 'template',
      version: 1,
      fieldSchemas: {
        billing_street: { type: 'text', name: 'Street', label: 'Street' },
        billing_city: { type: 'text', name: 'City', label: 'City' },
        anamnesis_complaints: { type: 'tree', name: 'Complaints', label: 'Complaints' },
      },
      blocks: [
        {
          type: 'documentSection',
          data: {
            name: 'Billing',
            label: 'Billing',
            segments: [
              { type: 'field', id: 'billing_street' },
              { type: 'field', id: 'billing_city' },
            ],
            fieldValues: {},
          },
        },
        {
          type: 'documentSection',
          data: {
            name: 'Anamnesis',
            label: 'Anamnesis',
            segments: [{ type: 'field', id: 'anamnesis_complaints' }],
            fieldValues: {},
          },
        },
      ],
    };

    const imported = parseRepeaterTemplateImport(editorTemplate, 'section_repeater');
    assert.ok(imported.template?.blocks?.length === 2);
    assert.ok(imported.fieldSchemas.street);
    assert.ok(imported.fieldSchemas.city);
    assert.ok(imported.fieldSchemas.complaints);

    const prefix = repeaterChildNamespacePrefix('section_repeater');
    assert.ok(imported.template.fieldSchemas[`${prefix}billing_street`]);
    assert.ok(imported.template.fieldSchemas[`${prefix}anamnesis_complaints`]);

    const parentFieldSchemas = {
      anamnesis_complaints: { type: 'tree', label: 'Complaints' },
      billing_street: { type: 'text', label: 'Street' },
    };
    const applied = applyRepeaterTemplateImport(
      { type: 'child', label: 'Child', name: 'repeater', fieldSchemas: {} },
      imported,
    );
    const cleaned = sanitizeRepeaterChildSchemas(applied, parentFieldSchemas, editorTemplate.blocks);
    assert.strictEqual(cleaned.template?.blocks?.length, 2);
    assert.ok(cleaned.fieldSchemas.street);
    assert.ok(repeaterHasTemplate(cleaned));
  });

  it('buildRepeaterFillDocument preserves uploaded section layout', () => {
    const imported = parseRepeaterTemplateImport(
      {
        kind: 'template',
        fieldSchemas: {
          billing_street: { type: 'text', name: 'Street', label: 'Street' },
          billing_city: { type: 'text', name: 'City', label: 'City' },
        },
        blocks: [
          {
            type: 'documentSection',
            data: {
              label: 'Billing',
              segments: [
                { type: 'field', id: 'billing_street' },
                { type: 'field', id: 'billing_city' },
              ],
              fieldValues: {},
            },
          },
          {
            type: 'documentSection',
            data: {
              label: 'Shipping',
              segments: [{ type: 'text', content: 'Note' }],
              fieldValues: {},
            },
          },
        ],
      },
      'addr_repeater',
    );
    const schema = applyRepeaterTemplateImport(
      { type: 'child', label: 'Address', name: 'address', fieldSchemas: {} },
      imported,
    );
    const doc = buildRepeaterFillDocument(schema, { street: 'Arogno', city: 'Milan' });
    assert.strictEqual(doc.blocks.length, 2);
    assert.strictEqual(doc.blocks[0].data.label, 'Billing');
    assert.strictEqual(doc.blocks[1].data.label, 'Shipping');

    const prefix = repeaterChildNamespacePrefix('addr_repeater');
    assert.strictEqual(doc.blocks[0].data.fieldValues[`${prefix}billing_street`], 'Arogno');
    assert.strictEqual(doc.blocks[0].data.fieldValues[`${prefix}billing_city`], 'Milan');

    const roundTrip = extractRepeaterValueFromDocument(doc, schema);
    assert.deepEqual(roundTrip, { street: 'Arogno', city: 'Milan' });
  });

  it('round-trips nested table cell values inside a child template', () => {
    const childFieldId = 'main_table_row1_item';
    const imported = parseRepeaterTemplateImport(
      {
        kind: 'template',
        fieldSchemas: {
          item_header: { type: 'text', name: 'header', label: 'header' },
          item_table: {
            type: 'table',
            name: 'inner',
            label: 'inner',
            columns: [
              { key: 'id', label: 'id', name: 'id' },
              { key: 'name', label: 'name', name: 'name' },
            ],
            rows: [{ key: 'row1', label: '' }],
          },
          item_table_row1_id: { type: 'text', name: 'id', label: 'id' },
          item_table_row1_name: { type: 'text', name: 'name', label: 'name' },
          item_table_row2_id: { type: 'text', name: 'id', label: 'id' },
          item_table_row2_name: { type: 'text', name: 'name', label: 'name' },
        },
        blocks: [
          {
            type: 'documentSection',
            data: {
              label: 'item',
              segments: [
                { type: 'field', id: 'item_header' },
                {
                  type: 'table',
                  id: 'item_table',
                  rows: [
                    { key: 'row1', label: '' },
                    { key: 'row2', label: '' },
                  ],
                },
              ],
              fieldValues: {},
            },
          },
        ],
      },
      childFieldId,
    );
    const schema = applyRepeaterTemplateImport(
      { type: 'child', label: 'item', name: 'item', fieldSchemas: {} },
      imported,
    );

    const prefix = repeaterChildNamespacePrefix(childFieldId);
    const tableId = `${prefix}item_table`;
    const filledDoc = {
      time: Date.now(),
      fieldSchemas: schema.template.fieldSchemas,
      blocks: [
        {
          type: 'documentSection',
          data: {
            label: 'item',
            segments: [
              { type: 'field', id: `${prefix}item_header` },
              {
                type: 'table',
                id: tableId,
                rows: [
                  { key: 'row1', label: '' },
                  { key: 'row2', label: '' },
                ],
              },
            ],
            fieldValues: {
              [`${prefix}item_header`]: 'header 123',
              [`${tableId}_row1_id`]: '10',
              [`${tableId}_row1_name`]: '1213123',
              [`${tableId}_row2_id`]: '12',
              [`${tableId}_row2_name`]: '121',
            },
          },
        },
      ],
    };

    const extracted = extractRepeaterValueFromDocument(filledDoc, schema);
    assert.equal(extracted.header, 'header 123');
    assert.equal(extracted[`${childFieldId}_item_table_row1_id`], '10');
    assert.equal(extracted[`${childFieldId}_item_table_row1_name`], '1213123');
    assert.equal(extracted[`${childFieldId}_item_table_row2_id`], '12');
    assert.equal(extracted[`${childFieldId}_item_table_row2_name`], '121');

    const rebuild = buildRepeaterFillDocument(schema, extracted);
    const values = rebuild.blocks[0].data.fieldValues;
    assert.equal(values[`${prefix}item_header`], 'header 123');
    assert.equal(values[`${tableId}_row1_id`], '10');
    assert.equal(values[`${tableId}_row1_name`], '1213123');
    assert.equal(values[`${tableId}_row2_id`], '12');
    assert.equal(values[`${tableId}_row2_name`], '121');

    const tableSeg = rebuild.blocks[0].data.segments.find((seg) => seg.type === 'table');
    assert.ok(tableSeg);
    assert.deepEqual(
      (tableSeg.rows ?? []).map((row) => row.key),
      ['row1', 'row2'],
    );
  });

  it('round-trips nested table values for legacy short storage keys', () => {
    const childFieldId = 'main_table_row1_item';
    const prefix = repeaterChildNamespacePrefix(childFieldId);
    const tableId = `${prefix}item_table`;
    const schema = {
      type: 'child',
      label: 'item',
      name: 'item',
      fieldSchemas: {
        header: { type: 'text', name: 'header', label: 'header' },
        id: { type: 'text', name: 'id', label: 'id' },
        name: { type: 'text', name: 'name', label: 'name' },
      },
      template: {
        fieldSchemas: {
          [`${prefix}item_header`]: { type: 'text', name: 'header', label: 'header' },
          [tableId]: {
            type: 'table',
            name: 'inner',
            label: 'inner',
            columns: [
              { key: 'id', label: 'id', name: 'id' },
              { key: 'name', label: 'name', name: 'name' },
            ],
            rows: [{ key: 'row1', label: '' }],
          },
          [`${tableId}_row1_id`]: { type: 'text', name: 'id', label: 'id' },
          [`${tableId}_row1_name`]: { type: 'text', name: 'name', label: 'name' },
          [`${tableId}_row2_id`]: { type: 'text', name: 'id', label: 'id' },
          [`${tableId}_row2_name`]: { type: 'text', name: 'name', label: 'name' },
        },
        blocks: [
          {
            type: 'documentSection',
            data: {
              label: 'item',
              segments: [
                { type: 'field', id: `${prefix}item_header` },
                {
                  type: 'table',
                  id: tableId,
                  rows: [
                    { key: 'row1', label: '' },
                    { key: 'row2', label: '' },
                  ],
                },
              ],
              fieldValues: {},
            },
          },
        ],
      },
    };

    const filledDoc = {
      time: Date.now(),
      fieldSchemas: schema.template.fieldSchemas,
      blocks: [
        {
          type: 'documentSection',
          data: {
            label: 'item',
            segments: schema.template.blocks[0].data.segments,
            fieldValues: {
              [`${prefix}item_header`]: 'header 123',
              [`${tableId}_row1_id`]: '10',
              [`${tableId}_row1_name`]: '1213123',
              [`${tableId}_row2_id`]: '12',
              [`${tableId}_row2_name`]: '121',
            },
          },
        },
      ],
    };

    const extracted = extractRepeaterValueFromDocument(filledDoc, schema);
    const rebuild = buildRepeaterFillDocument(schema, extracted);
    const values = rebuild.blocks[0].data.fieldValues;
    assert.equal(values[`${prefix}item_header`], 'header 123');
    assert.equal(values[`${tableId}_row1_id`], '10');
    assert.equal(values[`${tableId}_row1_name`], '1213123');
    assert.equal(values[`${tableId}_row2_id`], '12');
    assert.equal(values[`${tableId}_row2_name`], '121');
  });

  it('keeps nested table rows added beyond the template seed rows', () => {
    const childFieldId = 'main_table_row1_item';
    const prefix = repeaterChildNamespacePrefix(childFieldId);
    const tableId = `${prefix}item_table`;
    const schema = normalizeRepeaterSchema({
      type: 'child',
      label: 'item',
      name: 'item',
      fieldSchemas: {},
      template: {
        fieldSchemas: {
          [`${prefix}item_table`]: {
            type: 'table',
            label: 'Table',
            name: 'Table',
            columns: [
              { key: 'id', label: 'id', name: 'id' },
              { key: 'name', label: 'name', name: 'name' },
            ],
          },
          [`${tableId}_row1_id`]: { type: 'text', label: 'id', name: 'id' },
          [`${tableId}_row1_name`]: { type: 'text', label: 'name', name: 'name' },
        },
        blocks: [
          {
            type: 'documentSection',
            data: {
              label: 'item',
              segments: [
                { type: 'table', id: tableId, rows: [{ key: 'row1', label: '' }] },
              ],
              fieldValues: {},
            },
          },
        ],
      },
    });

    // Value contains a second row that does not exist in the template.
    const value = {
      [`${childFieldId}_item_table_row1_id`]: '10',
      [`${childFieldId}_item_table_row1_name`]: 'name2',
      [`${childFieldId}_item_table_row2_id`]: '101',
      [`${childFieldId}_item_table_row2_name`]: 'namee 3',
    };

    const normalized = normalizeRepeaterValue(value, schema);
    assert.equal(normalized[`${childFieldId}_item_table_row2_name`], 'namee 3');

    const doc = buildRepeaterFillDocument(schema, value);
    const fv = doc.blocks[0].data.fieldValues;
    assert.equal(fv[`${tableId}_row1_id`], '10');
    assert.equal(fv[`${tableId}_row2_id`], '101');
    assert.equal(fv[`${tableId}_row2_name`], 'namee 3');

    const tableSeg = doc.blocks[0].data.segments.find((seg) => seg.type === 'table');
    assert.deepEqual((tableSeg.rows ?? []).map((r) => r.key), ['row1', 'row2']);
    // Row2 cell schemas were cloned so preview can render them.
    assert.ok(doc.fieldSchemas[`${tableId}_row2_id`]);
    assert.ok(doc.fieldSchemas[`${tableId}_row2_name`]);
  });

  it('mergeRepeaterDomValues does not wipe stored values with empty DOM tokens', () => {
    const childFieldId = 'main_table_row1_item';
    const prefix = repeaterChildNamespacePrefix(childFieldId);
    const tableId = `${prefix}item_table`;
    const schema = {
      type: 'child',
      label: 'item',
      name: 'item',
      fieldSchemas: {
        id: { type: 'text', name: 'id', label: 'id' },
        name: { type: 'text', name: 'name', label: 'name' },
      },
      template: {
        fieldSchemas: {
          [`${tableId}_row1_id`]: { type: 'text', name: 'id', label: 'id' },
          [`${tableId}_row1_name`]: { type: 'text', name: 'name', label: 'name' },
        },
        blocks: [
          {
            type: 'documentSection',
            data: {
              segments: [
                {
                  type: 'table',
                  id: tableId,
                  rows: [{ key: 'row1', label: '' }],
                },
              ],
              fieldValues: {},
            },
          },
        ],
      },
    };

    const merged = mergeRepeaterDomValues(
      { id: '10', name: 'name2' },
      {
        [`${tableId}_row1_id`]: '10',
        [`${tableId}_row1_name`]: '',
      },
      schema,
    );
    assert.equal(merged.id, '10');
    assert.equal(merged.name, 'name2');
  });

  it('preserves template.blocks through normalizeRepeaterSchema', () => {
    const schema = normalizeRepeaterSchema({
      type: 'child',
      label: 'Repeater',
      name: 'repeater',
      fieldSchemas: { street: { type: 'text', name: 'Street', label: 'Street' } },
      template: {
        blocks: [{ type: 'documentSection', data: { segments: [], fieldValues: {} } }],
        fieldSchemas: { _repeater_x_street: { type: 'text', name: 'Street', label: 'Street' } },
      },
    });
    assert.ok(schema.template?.blocks?.length);
  });

  it('syncs nested table cell schemas from fill without expanding seed template rows', () => {
    const childFieldId = 'main_table_2_row1_column_2';
    const prefix = repeaterChildNamespacePrefix(childFieldId);
    const tableId = `${prefix}item_table`;
    const schema = normalizeRepeaterSchema({
      type: 'child',
      label: 'Column 2',
      name: 'Column 2',
      fieldSchemas: {},
      template: {
        fieldSchemas: {
          [tableId]: {
            type: 'table',
            label: 'Table',
            columns: [
              { key: 'id', label: 'id' },
              { key: 'name', label: 'name' },
            ],
            rows: [{ key: 'row1', label: '' }],
          },
          [`${tableId}_row1_id`]: { type: 'text', label: 'id' },
          [`${tableId}_row1_name`]: { type: 'text', label: 'name' },
        },
        blocks: [
          {
            type: 'documentSection',
            data: {
              label: 'item',
              segments: [{ type: 'table', id: tableId, rows: [{ key: 'row1', label: '' }] }],
              fieldValues: {},
            },
          },
        ],
      },
    });

    const fillDoc = {
      time: 1,
      fieldSchemas: {
        ...schema.template.fieldSchemas,
        [`${tableId}_row2_id`]: { type: 'text', label: 'id' },
        [`${tableId}_row2_name`]: { type: 'text', label: 'name' },
      },
      blocks: [
        {
          type: 'documentSection',
          data: {
            label: 'item',
            segments: [
              {
                type: 'table',
                id: tableId,
                rows: [
                  { key: 'row1', label: '' },
                  { key: 'row2', label: '' },
                ],
              },
            ],
            fieldValues: {
              [`${tableId}_row1_id`]: '10',
              [`${tableId}_row1_name`]: '123123',
              [`${tableId}_row2_id`]: '1023',
              [`${tableId}_row2_name`]: 'test name',
            },
          },
        },
      ],
    };

    const synced = syncRepeaterTemplateFromFillDocument(schema, fillDoc);
    const tableSeg = synced.template.blocks[0].data.segments.find((seg) => seg.type === 'table');
    // Seed layout stays one row so "+ Row" clones do not inherit instance rows.
    assert.deepEqual(
      (tableSeg.rows ?? []).map((row) => row.key),
      ['row1'],
    );
    assert.ok(synced.template.fieldSchemas[`${tableId}_row2_name`]);
  });

  it('rejects oversized repeater template imports', () => {
    const fieldSchemas = {};
    for (let i = 0; i < 26; i += 1) {
      fieldSchemas[`field_${i}`] = { type: 'text', label: `Field ${i}` };
    }
    assert.throws(
      () => parseRepeaterTemplateImport({ kind: REPEATER_TEMPLATE_FILE_KIND, fieldSchemas }),
      /max 25/,
    );
  });
});
