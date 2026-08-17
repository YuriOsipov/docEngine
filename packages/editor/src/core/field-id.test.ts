// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ROOT_SECTION_KEY,
  deriveFieldId,
  deriveUniqueFieldName,
  allocateFieldIdentity,
  findFieldPlacement,
  migrateFieldIds,
  resolveFieldIdByName,
  resolveSectionName,
  slugSectionKey,
  isFieldNameTakenInSection,
  allocateUniqueSectionName,
} from './field-id.js';
import { applyFieldIdChange } from './field-schemas.js';

describe('resolveSectionName', () => {
  it('prefers name over label', () => {
    assert.equal(resolveSectionName({ name: 'Anamnesis', label: 'Анамнез' }), 'Anamnesis');
  });

  it('falls back to label when name is missing', () => {
    assert.equal(resolveSectionName({ label: 'Examination' }), 'Examination');
  });

  it('defaults empty name/label to Untitled', () => {
    assert.equal(resolveSectionName({}), 'Untitled');
    assert.equal(resolveSectionName({ name: '', label: '' }), 'Untitled');
  });
});

describe('allocateUniqueSectionName', () => {
  it('returns base when unused', () => {
    assert.equal(allocateUniqueSectionName(new Set()), 'Untitled');
  });

  it('suffixes when Untitled is taken', () => {
    const used = new Set(['Untitled']);
    assert.equal(allocateUniqueSectionName(used), 'Untitled_2');
    used.add('Untitled_2');
    assert.equal(allocateUniqueSectionName(used), 'Untitled_3');
  });
});

describe('slugSectionKey', () => {
  it('returns _root for empty label', () => {
    assert.equal(slugSectionKey(''), ROOT_SECTION_KEY);
    assert.equal(slugSectionKey(ROOT_SECTION_KEY), ROOT_SECTION_KEY);
  });

  it('slugifies section labels', () => {
    assert.equal(slugSectionKey('Examination'), 'examination');
  });
});

describe('deriveFieldId', () => {
  it('builds section_field ids', () => {
    assert.equal(deriveFieldId('Examination', 'Orbit OD'), 'examination_orbit_od');
    assert.equal(deriveFieldId(ROOT_SECTION_KEY, 'Visual acuity'), '_root_visual_acuity');
  });

  it('dedupes within usedIds', () => {
    const used = new Set(['examination_orbit_od']);
    assert.equal(deriveFieldId('Examination', 'Orbit OD', used), 'examination_orbit_od_2');
  });
});

describe('deriveUniqueFieldName', () => {
  it('returns base name when unused', () => {
    assert.equal(deriveUniqueFieldName('ICD-10', new Set()), 'ICD-10');
  });

  it('appends numeric suffix for duplicates', () => {
    const used = new Set(['ICD-10']);
    assert.equal(deriveUniqueFieldName('ICD-10', used), 'ICD-10_2');
    used.add('ICD-10_2');
    assert.equal(deriveUniqueFieldName('ICD-10', used), 'ICD-10_3');
  });
});

describe('allocateFieldIdentity', () => {
  it('derives matching field id from unique field name', () => {
    const sectionBody = {
      closest: () => null,
      querySelectorAll: () => [],
    };
    const registry = {
      getFieldSchemas: () => ({
        diagnosis_icd_10: { type: 'list', name: 'ICD-10', label: 'ICD-10' },
      }),
    };
    Object.assign(sectionBody, {
      closest(selector) {
        if (selector === '[data-doc-editor]') return holder;
        if (selector === '.document-section') return section;
        return null;
      },
    });
    const section = {
      querySelector: () => null,
      dataset: { sectionName: 'Diagnosis' },
    };
    const holder = {
      querySelectorAll(selector) {
        if (selector === '.document-section__body') return [sectionBody];
        return [];
      },
    };
    sectionBody.querySelectorAll = (selector) => {
      if (selector === '.field-token[data-field-id]') {
        return [{ dataset: { fieldId: 'diagnosis_icd_10' } }];
      }
      if (selector === '.document-table[data-table-id]') return [];
      return [];
    };

    const { fieldId, fieldName } = allocateFieldIdentity(sectionBody, registry, 'ICD-10');
    assert.equal(fieldName, 'ICD-10_2');
    assert.equal(fieldId, 'diagnosis_icd_10_2');
  });
});

describe('findFieldPlacement', () => {
  it('finds documentSection fields', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          label: 'Examination',
          segments: [{ type: 'field', id: 'examination_orbit_od' }],
        },
      },
    ];
    const placement = findFieldPlacement('examination_orbit_od', blocks);
    assert.equal(placement.sectionName, 'Examination');
    assert.equal(placement.sectionLabel, 'Examination');
    assert.equal(placement.blockType, 'documentSection');
  });

  it('finds fields nested inside columns layout', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          name: 'Examination',
          segments: [
            {
              type: 'columns',
              columns: [[{ type: 'field', id: 'examination_weight' }], []],
            },
          ],
        },
      },
    ];
    const placement = findFieldPlacement('examination_weight', blocks);
    assert.equal(placement.sectionName, 'Examination');
    assert.equal(placement.blockType, 'documentSection');
  });
});

describe('field identity inside columns layout', () => {
  const blocks = [
    {
      type: 'documentSection',
      data: {
        name: 'Examination',
        segments: [
          {
            type: 'columns',
            columns: [[{ type: 'field', id: 'examination_weight' }], []],
          },
        ],
        fieldValues: { examination_weight: '70' },
      },
    },
  ];
  const schemas = {
    examination_weight: { type: 'integer', name: 'Weight', label: 'Weight' },
  };

  it('derives section-prefixed id from field name', () => {
    const used = new Set(Object.keys(schemas));
    used.delete('examination_weight');
    assert.equal(deriveFieldId('Examination', 'Body weight', used), 'examination_body_weight');
  });

  it('detects duplicate field names in the same section', () => {
    assert.equal(
      isFieldNameTakenInSection('Examination', 'Weight', 'other_id', blocks, schemas),
      true,
    );
  });

  it('renames field id inside columns segments', () => {
    const updated = { ...schemas.examination_weight, name: 'Body weight' };
    const result = applyFieldIdChange(
      'examination_weight',
      'examination_body_weight',
      updated,
      schemas,
      blocks,
    );
    assert.ok(result.fieldSchemas.examination_body_weight);
    assert.equal(
      result.blocks[0].data.segments[0].columns[0][0].id,
      'examination_body_weight',
    );
    assert.equal(result.blocks[0].data.fieldValues.examination_body_weight, '70');
  });
});

describe('resolveFieldIdByName', () => {
  it('resolves field by section label and name', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          label: 'Examination',
          segments: [{ type: 'field', id: 'examination_orbit_od' }],
        },
      },
    ];
    const schemas = {
      examination_orbit_od: { type: 'choice', name: 'Orbit OD', label: 'OD' },
    };
    assert.equal(
      resolveFieldIdByName('Examination', 'Orbit OD', blocks, schemas),
      'examination_orbit_od',
    );
  });
});

describe('migrateFieldIds', () => {
  it('migrates legacy field ids to derived ids', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          label: 'Examination',
          segments: [{ type: 'field', id: 'orbitOd' }],
          fieldValues: { orbitOd: 'norm' },
        },
      },
    ];
    const schemas = {
      orbitOd: { type: 'choice', name: 'Orbit OD', label: 'OD' },
    };
    const migrated = migrateFieldIds(blocks, schemas);
    assert.ok(migrated.fieldSchemas.examination_orbit_od);
    assert.equal(migrated.blocks[0].data.segments[0].id, 'examination_orbit_od');
    assert.equal(migrated.blocks[0].data.fieldValues.examination_orbit_od, 'norm');
  });

  it('preserves _repeater_ child field ids so the modal round-trip stays stable', () => {
    const tableId = '_repeater_main_table_row1_column_2_item_table';
    const headerId = '_repeater_main_table_row1_column_2_item_header';
    const blocks = [
      {
        type: 'documentSection',
        data: {
          label: 'item',
          name: 'item',
          segments: [
            { type: 'field', id: headerId },
            { type: 'table', id: tableId, rows: [{ key: 'row1', label: '' }] },
          ],
          fieldValues: { [`${tableId}_row1_id`]: '1' },
        },
      },
    ];
    const schemas = {
      [headerId]: { type: 'text', name: 'header', label: 'header' },
      [tableId]: {
        type: 'table',
        name: 'inner',
        label: 'inner',
        columns: [
          { key: 'id', label: 'id' },
          { key: 'name', label: 'name' },
        ],
        rows: [{ key: 'row1', label: '' }],
      },
      [`${tableId}_row1_id`]: { type: 'text', name: 'id', label: 'id' },
      [`${tableId}_row1_name`]: { type: 'text', name: 'name', label: 'name' },
    };

    const migrated = migrateFieldIds(blocks, schemas);

    // Ids must NOT be re-derived from section/field names; otherwise the saved
    // values can no longer be mapped back to their storage keys.
    assert.ok(migrated.fieldSchemas[tableId], 'table id preserved');
    assert.ok(migrated.fieldSchemas[headerId], 'header id preserved');
    assert.equal(migrated.blocks[0].data.segments[0].id, headerId);
    assert.equal(migrated.blocks[0].data.segments[1].id, tableId);
    assert.equal(migrated.blocks[0].data.fieldValues[`${tableId}_row1_id`], '1');
  });
});
