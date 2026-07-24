import type { DateFieldSchema, FieldHandler, FieldSchema } from '@docengine/editor';
import {
  formatDateValue,
  applyCustomDatePattern,
  DEFAULT_DATE_FORMAT,
  DEFAULT_CUSTOM_DATE_FORMAT,
  type DateDisplayFormat,
  type FormatDateValueOptions,
} from '@docengine/engine';

export {
  formatDateValue,
  applyCustomDatePattern,
  DEFAULT_DATE_FORMAT,
  DEFAULT_CUSTOM_DATE_FORMAT,
  type DateDisplayFormat,
  type FormatDateValueOptions,
};

const DATE_FORMAT_OPTIONS: { value: DateDisplayFormat; label: string }[] = [
  { value: 'dd/mm/yyyy', label: 'DD/MM/YYYY' },
  { value: 'mm/dd/yyyy', label: 'MM/DD/YYYY' },
  { value: 'iso', label: 'YYYY-MM-DD' },
  { value: 'd mmm yyyy', label: 'D Mon YYYY' },
  { value: 'custom', label: 'Custom' },
];

function escapeAttr(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function readInputValue(host: ParentNode, field: string): string {
  const el = host.querySelector(`[data-field="${field}"]`);
  if (el && 'value' in el && typeof (el as HTMLInputElement).value === 'string') {
    return (el as HTMLInputElement).value;
  }
  return '';
}

function localTodayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function scalarEmpty(value: unknown): boolean {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}

function asDateSchema(schema: FieldSchema | Record<string, unknown>): DateFieldSchema {
  return schema as DateFieldSchema;
}

function normalizeDateFormat(format: unknown): DateDisplayFormat {
  if (
    format === 'iso' ||
    format === 'dd/mm/yyyy' ||
    format === 'mm/dd/yyyy' ||
    format === 'd mmm yyyy' ||
    format === 'custom'
  ) {
    return format;
  }
  return DEFAULT_DATE_FORMAT;
}

/** Reference `FieldHandler` for `type: 'date'`. */
export const dateFieldHandler: FieldHandler = {
  type: 'date',
  label: 'Date',
  paletteOrder: 30,
  createSchema(label, name) {
    const schema: DateFieldSchema = {
      type: 'date',
      label,
      name: name || label,
      required: false,
      defaultMode: 'today',
      defaultDate: '',
      dateFormat: DEFAULT_DATE_FORMAT,
      customDateFormat: '',
    };
    return schema;
  },
  getEmptyValue: () => '',
  resolveDefaultValue(schema, { forTemplate = false } = {}) {
    const dateSchema = asDateSchema(schema);
    if (dateSchema.defaultMode === 'fixed' && dateSchema.defaultDate) return dateSchema.defaultDate;
    if (!forTemplate && (dateSchema.defaultMode ?? 'today') === 'today') return localTodayIso();
    return '';
  },
  toDisplayConfig(schema) {
    return { picker: 'date', label: asDateSchema(schema).label };
  },
  toPickerConfig(schema) {
    const dateSchema = asDateSchema(schema);
    return {
      picker: 'date',
      label: dateSchema.label,
      defaultMode: dateSchema.defaultMode ?? 'today',
      defaultDate: dateSchema.defaultDate ?? '',
      dateFormat: normalizeDateFormat(dateSchema.dateFormat),
      customDateFormat: dateSchema.customDateFormat ?? '',
    };
  },
  renderSchemaFields(host, schema) {
    const dateSchema = asDateSchema(schema);
    const mode = dateSchema.defaultMode ?? 'today';
    const dateFormat = normalizeDateFormat(dateSchema.dateFormat);
    const customPattern = String(dateSchema.customDateFormat ?? '');
    const formatOptions = DATE_FORMAT_OPTIONS.map(
      (opt) =>
        `<option value="${opt.value}"${opt.value === dateFormat ? ' selected' : ''}>${opt.label}</option>`,
    ).join('');
    host.innerHTML = `
      <label class="schema-form__row">
        <span>Date format</span>
        <select data-field="dateFormat">
          ${formatOptions}
        </select>
      </label>
      <label class="schema-form__row" data-role="custom-format-row">
        <span>Custom pattern</span>
        <input type="text" data-field="customDateFormat" value="${escapeAttr(customPattern)}" placeholder="${DEFAULT_CUSTOM_DATE_FORMAT}" />
      </label>
      <p class="schema-form__hint" data-role="custom-format-hint">Tokens: YYYY YY MMMM MMM MM M DD D (e.g. DD.MM.YYYY)</p>
      <label class="schema-form__row">
        <span>Default</span>
        <select data-field="defaultMode">
          <option value="today"${mode === 'today' ? ' selected' : ''}>Current date (when filling)</option>
          <option value="fixed"${mode === 'fixed' ? ' selected' : ''}>Fixed date</option>
        </select>
      </label>
      <label class="schema-form__row" data-role="fixed-date-row">
        <span>Fixed date</span>
        <input type="date" data-field="defaultDate" value="${escapeAttr(dateSchema.defaultDate ?? '')}" />
      </label>
    `;
    const modeSelect = host.querySelector('[data-field="defaultMode"]');
    const formatSelect = host.querySelector('[data-field="dateFormat"]');
    const fixedRow = host.querySelector('[data-role="fixed-date-row"]');
    const customRow = host.querySelector('[data-role="custom-format-row"]');
    const customHint = host.querySelector('[data-role="custom-format-hint"]');
    const setHidden = (el: Element | null, hidden: boolean) => {
      if (el && 'hidden' in el) {
        (el as HTMLElement).hidden = hidden;
      }
    };
    setHidden(fixedRow, mode !== 'fixed');
    setHidden(customRow, dateFormat !== 'custom');
    setHidden(customHint, dateFormat !== 'custom');
    modeSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement | null;
      if (!target || typeof target.value !== 'string') return;
      setHidden(fixedRow, target.value !== 'fixed');
    });
    formatSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement | null;
      if (!target || typeof target.value !== 'string') return;
      const isCustom = target.value === 'custom';
      setHidden(customRow, !isCustom);
      setHidden(customHint, !isCustom);
    });
  },
  readSchemaFields(host) {
    return {
      dateFormat: normalizeDateFormat(readInputValue(host, 'dateFormat') || DEFAULT_DATE_FORMAT),
      customDateFormat: readInputValue(host, 'customDateFormat'),
      defaultMode: readInputValue(host, 'defaultMode') || 'today',
      defaultDate: readInputValue(host, 'defaultDate'),
    };
  },
  formatDisplay(value, { emptyLabel, schema }) {
    if (scalarEmpty(value)) return emptyLabel ?? '';
    const dateSchema = asDateSchema(schema ?? { type: 'date' });
    return formatDateValue(value, dateSchema.dateFormat, {
      customDateFormat: dateSchema.customDateFormat,
    });
  },
  isEmpty(value, _schema) {
    return scalarEmpty(value);
  },
  pdfRenderMode: () => 'plain',
};
