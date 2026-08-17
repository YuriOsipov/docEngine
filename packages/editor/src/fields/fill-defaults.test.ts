import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { registerField, registerBuiltinFields } from './handlers/index.js';
import { dateFieldHandler } from '@docengine/field-date';
import { localTodayIso } from '../core/field-schemas.js';
import { resolveValueOrFillDefault } from './inline-fields.js';

describe('resolveValueOrFillDefault', () => {
  before(() => {
    registerBuiltinFields();
    if (!dateFieldHandler || dateFieldHandler.type !== 'date') {
      throw new Error('date field handler unavailable');
    }
    registerField(dateFieldHandler);
  });

  it('leaves empty date values empty in design mode', () => {
    const schema = {
      type: 'date',
      label: 'Date',
      name: 'Date',
      defaultMode: 'today',
    };
    assert.equal(resolveValueOrFillDefault(schema, '', { designMode: true }), '');
    assert.equal(resolveValueOrFillDefault(schema, undefined, { designMode: true }), '');
  });

  it('populates current date in fill mode when defaultMode is today', () => {
    const schema = {
      type: 'date',
      label: 'Date',
      name: 'Date',
      defaultMode: 'today',
    };
    assert.equal(resolveValueOrFillDefault(schema, '', { designMode: false }), localTodayIso());
    assert.equal(resolveValueOrFillDefault(schema, undefined, { designMode: false }), localTodayIso());
  });

  it('keeps an existing date value', () => {
    const schema = {
      type: 'date',
      label: 'Date',
      name: 'Date',
      defaultMode: 'today',
    };
    assert.equal(
      resolveValueOrFillDefault(schema, '2024-01-15', { designMode: false }),
      '2024-01-15',
    );
  });

  it('uses fixed default date when selected', () => {
    const schema = {
      type: 'date',
      label: 'Date',
      name: 'Date',
      defaultMode: 'fixed',
      defaultDate: '2024-06-01',
    };
    assert.equal(
      resolveValueOrFillDefault(schema, '', { designMode: false }),
      '2024-06-01',
    );
  });

  it('applies other field defaults the same way in fill mode', () => {
    assert.equal(
      resolveValueOrFillDefault(
        { type: 'text', label: 'Note', name: 'Note', defaultText: 'hello' },
        '',
        { designMode: false },
      ),
      'hello',
    );
  });

  it('keeps populated child field objects (not treat them as empty images)', () => {
    const schema = {
      type: 'child',
      label: 'address',
      name: 'address',
      fieldSchemas: {
        city: { type: 'text', name: 'City', label: 'City' },
      },
    };
    const value = { city: 'milan' };
    assert.deepEqual(resolveValueOrFillDefault(schema, value, { designMode: false }), value);
  });
});
