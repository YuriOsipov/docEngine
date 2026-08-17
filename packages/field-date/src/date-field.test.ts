import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseHTML } from 'linkedom';
import type { DateFieldSchema, FieldHandler } from '@docengine/editor/types';
import {
  dateFieldHandler,
  formatDateValue,
  registerDateField,
  DEFAULT_DATE_FORMAT,
} from './index.js';

describe('@docengine/field-date', () => {
  it('exposes a complete date FieldHandler', () => {
    assert.equal(dateFieldHandler.type, 'date');
    assert.equal(dateFieldHandler.label, 'Date');
    assert.equal(typeof dateFieldHandler.renderSchemaFields, 'function');
    assert.equal(typeof dateFieldHandler.readSchemaFields, 'function');
    assert.equal(typeof dateFieldHandler.formatDisplay, 'function');
    assert.equal(dateFieldHandler.pdfRenderMode?.({ type: 'date' }), 'plain');

    const schema = dateFieldHandler.createSchema('Document date', 'Document date') as DateFieldSchema;
    assert.equal(schema.type, 'date');
    assert.equal(schema.defaultMode, 'today');
    assert.equal(schema.dateFormat, DEFAULT_DATE_FORMAT);
    assert.equal(
      dateFieldHandler.resolveDefaultValue({ ...schema, defaultMode: 'fixed', defaultDate: '2024-05-01' }),
      '2024-05-01',
    );
    assert.equal(
      dateFieldHandler.formatDisplay?.('2024-05-01', {
        emptyLabel: 'Document',
        schema: { ...schema, dateFormat: 'iso' },
      }),
      '2024-05-01',
    );
    assert.equal(dateFieldHandler.isEmpty?.('', { type: 'date' }), true);
  });

  it('formats ISO dates for display', () => {
    assert.equal(formatDateValue('2026-07-22', 'dd/mm/yyyy'), '22/07/2026');
    assert.equal(formatDateValue('2026-07-22', 'mm/dd/yyyy'), '07/22/2026');
    assert.equal(formatDateValue('2026-07-22', 'iso'), '2026-07-22');
    assert.equal(formatDateValue('2026-07-22', 'd mmm yyyy'), '22 Jul 2026');
    assert.equal(
      formatDateValue('2026-07-22', 'custom', { customDateFormat: 'DD.MM.YYYY' }),
      '22.07.2026',
    );
    assert.equal(
      formatDateValue('2026-07-22', 'custom', { customDateFormat: 'D MMMM YYYY' }),
      '22 July 2026',
    );
    assert.equal(
      dateFieldHandler.formatDisplay?.('2026-07-22', {
        emptyLabel: 'Date',
        schema: {
          type: 'date',
          dateFormat: 'custom',
          customDateFormat: 'YYYY/MM/DD',
        },
      }),
      '2026/07/22',
    );
  });

  it('renders and reads designer form fields including custom dateFormat', () => {
    const { document } = parseHTML('<!doctype html><html><body></body></html>');
    const host = document.createElement('div');
    dateFieldHandler.renderSchemaFields?.(host, {
      type: 'date',
      label: 'Document',
      name: 'Document',
      defaultMode: 'fixed',
      defaultDate: '2024-06-01',
      dateFormat: 'custom',
      customDateFormat: 'DD.MM.YYYY',
    });
    const mode = host.querySelector('[data-field="defaultMode"]') as HTMLSelectElement | null;
    const format = host.querySelector('[data-field="dateFormat"]') as HTMLSelectElement | null;
    const custom = host.querySelector('[data-field="customDateFormat"]') as HTMLInputElement | null;
    const customRow = host.querySelector('[data-role="custom-format-row"]') as HTMLElement | null;
    assert.ok(mode);
    assert.ok(format);
    assert.ok(custom);
    assert.ok(customRow);
    assert.equal(mode.value, 'fixed');
    assert.equal(format.value, 'custom');
    assert.equal(custom.value, 'DD.MM.YYYY');
    assert.equal(customRow.hidden, false);
    assert.deepEqual(dateFieldHandler.readSchemaFields?.(host, { type: 'date' }), {
      dateFormat: 'custom',
      customDateFormat: 'DD.MM.YYYY',
      defaultMode: 'fixed',
      defaultDate: '2024-06-01',
    });
  });

  it('registerDateField requires registerField', () => {
    assert.throws(() => registerDateField({} as never), /registerField/);
    const registered: FieldHandler[] = [];
    registerDateField({
      registerField(handler) {
        registered.push(handler);
        return handler;
      },
    });
    assert.equal(registered[0], dateFieldHandler);
  });
});
