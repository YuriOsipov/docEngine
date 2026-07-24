import {
  createEmptyImageValue,
  isImageValueEmpty,
  normalizeImageValue,
} from '../../services/image-upload.js';
import { isHtmlValueEmpty } from '../rich-text.js';
import { registerField } from './registry.js';
import { escapeAttr, readCheckbox, readInputValue } from './schema-form-dom.js';
import { formatNumericDisplay } from '@docengine/engine';

function baseSchema(type: any, label: any, name: any) {
  return { type, label, name: name || label, required: false };
}

function scalarEmpty(value: any) {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}

function normalizeIntegerDisplayFormat(value: unknown): 'plain' | 'number' | 'currency' {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'number' || raw === 'currency') return raw;
  return 'plain';
}

function readOptionalInteger(host: ParentNode, field: string): number | '' {
  const raw = readInputValue(host, field).trim();
  if (!raw) return '';
  const num = Number(raw);
  return Number.isInteger(num) && num >= 0 && num <= 20 ? num : '';
}

/** @type {import('./registry.js').FieldHandler[]} */
const BUILTIN_HANDLERS = [
  {
    type: 'text',
    label: 'Text',
    paletteOrder: 10,
    createSchema(label: any, name: any) {
      return { ...baseSchema('text', label, name), defaultText: '' };
    },
    getEmptyValue: () => '',
    resolveDefaultValue(schema: any) {
      return schema.defaultText ?? '';
    },
    toDisplayConfig(schema: any) {
      return { picker: 'text', label: schema.label, htmlEditor: !!schema.htmlEditor };
    },
    toPickerConfig(schema: any) {
      return {
        picker: 'text',
        label: schema.label,
        defaultText: schema.defaultText ?? '',
        htmlEditor: !!schema.htmlEditor,
      };
    },
    renderSchemaFields(host: any, schema: any) {
      host.innerHTML = `
        <label class="schema-form__row">
          <span>Default text</span>
          <input type="text" data-field="defaultText" value="${escapeAttr(schema.defaultText ?? '')}" />
        </label>
        <label class="schema-form__row schema-form__row--checkbox">
          <input type="checkbox" data-field="htmlEditor"${schema.htmlEditor ? ' checked' : ''} />
          <span>HTML editor</span>
        </label>
      `;
    },
    readSchemaFields(host: any) {
      const patch: any = { defaultText: readInputValue(host, 'defaultText') };
      if (readCheckbox(host, 'htmlEditor')) patch.htmlEditor = true;
      else patch.htmlEditor = undefined;
      return patch;
    },
    formatDisplay(value: any, { emptyLabel }: any) {
      if (scalarEmpty(value)) return emptyLabel ?? '';
      return String(value);
    },
    isEmpty(value: any, schema: any) {
      if (schema?.htmlEditor && typeof value === 'string') return isHtmlValueEmpty(value);
      return scalarEmpty(value);
    },
    pdfRenderMode(schema: any): 'html' | 'plain' {
      return schema?.htmlEditor ? 'html' : 'plain';
    },
  },
  {
    type: 'integer',
    label: 'Number',
    paletteOrder: 20,
    createSchema(label: any, name: any) {
      return {
        ...baseSchema('integer', label, name),
        min: 0,
        max: 999,
        defaultValue: '',
        suffix: '',
        displayFormat: 'plain',
        currencyCode: 'EUR',
      };
    },
    getEmptyValue: () => '',
    resolveDefaultValue(schema: any) {
      const value = schema.defaultValue;
      return value === '' || value == null ? '' : String(value);
    },
    toDisplayConfig(schema: any) {
      return {
        picker: 'integer',
        label: schema.label,
        suffix: schema.suffix ?? '',
        displayFormat: normalizeIntegerDisplayFormat(schema.displayFormat),
        currencyCode: schema.currencyCode ?? 'EUR',
        fractionDigits: schema.fractionDigits,
      };
    },
    toPickerConfig(schema: any) {
      return {
        picker: 'integer',
        label: schema.label,
        min: schema.min ?? 0,
        max: schema.max ?? 999,
        defaultValue: schema.defaultValue ?? '',
        suffix: schema.suffix ?? '',
        displayFormat: normalizeIntegerDisplayFormat(schema.displayFormat),
        currencyCode: schema.currencyCode ?? 'EUR',
        fractionDigits: schema.fractionDigits,
      };
    },
    renderSchemaFields(host: any, schema: any) {
      const displayFormat = normalizeIntegerDisplayFormat(schema.displayFormat);
      const fractionDigits =
        schema.fractionDigits == null || schema.fractionDigits === ''
          ? ''
          : String(schema.fractionDigits);
      host.innerHTML = `
        <label class="schema-form__row">
          <span>Min</span>
          <input type="number" data-field="min" value="${schema.min ?? 0}" />
        </label>
        <label class="schema-form__row">
          <span>Max</span>
          <input type="number" data-field="max" value="${schema.max ?? 999}" />
        </label>
        <label class="schema-form__row">
          <span>Default value</span>
          <input type="number" data-field="defaultValue" value="${escapeAttr(schema.defaultValue ?? '')}" />
        </label>
        <label class="schema-form__row">
          <span>Display format</span>
          <select data-field="displayFormat">
            <option value="plain"${displayFormat === 'plain' ? ' selected' : ''}>Plain</option>
            <option value="number"${displayFormat === 'number' ? ' selected' : ''}>Number</option>
            <option value="currency"${displayFormat === 'currency' ? ' selected' : ''}>Currency</option>
          </select>
        </label>
        <label class="schema-form__row" data-role="currency-code-row">
          <span>Currency</span>
          <input type="text" data-field="currencyCode" value="${escapeAttr(schema.currencyCode ?? 'EUR')}" placeholder="EUR" maxlength="3" />
        </label>
        <label class="schema-form__row" data-role="fraction-digits-row">
          <span>Fraction digits</span>
          <input type="number" data-field="fractionDigits" min="0" max="20" value="${escapeAttr(fractionDigits)}" placeholder="auto" />
        </label>
        <label class="schema-form__row" data-role="suffix-row">
          <span>Suffix</span>
          <input type="text" data-field="suffix" value="${escapeAttr(schema.suffix ?? '')}" placeholder="e.g. mmHg" />
        </label>
        <p class="schema-form__hint" data-role="display-format-hint">Stored value stays a plain number. Format applies in the document, preview, and PDF.</p>
      `;
      const formatSelect = host.querySelector('[data-field="displayFormat"]');
      const currencyRow = host.querySelector('[data-role="currency-code-row"]');
      const fractionRow = host.querySelector('[data-role="fraction-digits-row"]');
      const suffixRow = host.querySelector('[data-role="suffix-row"]');
      const setHidden = (el: Element | null, hidden: boolean) => {
        if (el && 'hidden' in el) (el as HTMLElement).hidden = hidden;
      };
      const syncRows = (mode: string) => {
        setHidden(currencyRow, mode !== 'currency');
        setHidden(fractionRow, mode === 'plain');
        setHidden(suffixRow, mode === 'currency');
      };
      syncRows(displayFormat);
      formatSelect?.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLSelectElement | null;
        if (!target) return;
        syncRows(normalizeIntegerDisplayFormat(target.value));
      });
    },
    readSchemaFields(host: any) {
      const defaultValue = readInputValue(host, 'defaultValue');
      const displayFormat = normalizeIntegerDisplayFormat(readInputValue(host, 'displayFormat'));
      const fractionDigits = readOptionalInteger(host, 'fractionDigits');
      const currencyCode = readInputValue(host, 'currencyCode').trim().toUpperCase() || 'EUR';
      return {
        min: Number(readInputValue(host, 'min') || 0),
        max: Number(readInputValue(host, 'max') || 999),
        defaultValue: defaultValue === '' ? '' : String(defaultValue),
        suffix: readInputValue(host, 'suffix'),
        displayFormat,
        currencyCode,
        fractionDigits,
      };
    },
    formatDisplay(value: any, { schema, def, emptyLabel }: any) {
      if (scalarEmpty(value)) return emptyLabel ?? '';
      return formatNumericDisplay(value, {
        displayFormat: def?.displayFormat ?? schema?.displayFormat,
        currencyCode: def?.currencyCode ?? schema?.currencyCode,
        fractionDigits: def?.fractionDigits ?? schema?.fractionDigits,
        suffix: def?.suffix ?? schema?.suffix,
      });
    },
    isEmpty(value: any) {
      return scalarEmpty(value);
    },
    pdfRenderMode: () => 'plain',
  },
  {
    type: 'computed',
    label: 'Computed',
    paletteOrder: 40,
    editableInFill: false,
    createSchema(label: any, name: any) {
      return { ...baseSchema('computed', label, name), formula: '' };
    },
    getEmptyValue: () => '',
    resolveDefaultValue() {
      return '';
    },
    toDisplayConfig(schema: any) {
      return { picker: 'computed', label: schema.label };
    },
    toPickerConfig(schema: any) {
      return { picker: 'computed', label: schema.label, formula: schema.formula ?? '' };
    },
    formatDisplay(value: any, { emptyLabel }: any) {
      if (scalarEmpty(value)) return emptyLabel ?? '';
      return String(value);
    },
    isEmpty(value: any) {
      return scalarEmpty(value);
    },
    pdfRenderMode: () => 'plain',
  },
  {
    type: 'image',
    label: 'Image',
    paletteOrder: 50,
    createSchema(label: any, name: any) {
      return { ...baseSchema('image', label, name), maxWidth: 320, altText: '' };
    },
    getEmptyValue: () => createEmptyImageValue(),
    resolveDefaultValue() {
      return createEmptyImageValue();
    },
    toDisplayConfig(schema: any) {
      return {
        picker: 'image',
        label: schema.label,
        maxWidth: schema.maxWidth ?? 320,
        altText: schema.altText ?? '',
      };
    },
    toPickerConfig(schema: any) {
      return {
        picker: 'image',
        label: schema.label,
        maxWidth: schema.maxWidth ?? 320,
        altText: schema.altText ?? '',
      };
    },
    renderSchemaFields(host: any, schema: any) {
      host.innerHTML = `
        <label class="schema-form__row">
          <span>Max width (px)</span>
          <input type="number" data-field="maxWidth" value="${schema.maxWidth ?? 320}" />
        </label>
        <label class="schema-form__row">
          <span>Alt text</span>
          <input type="text" data-field="altText" value="${escapeAttr(schema.altText ?? '')}" />
        </label>
        <p class="schema-form__hint">Image is chosen when filling the document, not in design mode.</p>
      `;
    },
    readSchemaFields(host: any) {
      return {
        maxWidth: Number(readInputValue(host, 'maxWidth') || 320),
        altText: readInputValue(host, 'altText'),
      };
    },
    formatDisplay(value: any, { emptyLabel }: any) {
      if (isImageValueEmpty(value)) return emptyLabel ?? '';
      const img = normalizeImageValue(value);
      return img.caption || '[Image]';
    },
    isEmpty(value: any) {
      return isImageValueEmpty(value);
    },
    pdfRenderMode: () => 'plain',
  },
  {
    type: 'list',
    label: 'List',
    paletteOrder: 60,
    createSchema(label: any, name: any) {
      return {
        ...baseSchema('list', label, name),
        multi: true,
        itemLayout: 'inline',
        itemPrefix: '',
        items: [{ id: 'item1', label: 'Option 1' }],
        defaultValue: [] as any[],
      };
    },
    getEmptyValue: (): any[] => [],
    resolveDefaultValue(schema: any) {
      return Array.isArray(schema.defaultValue) ? [...schema.defaultValue] : [];
    },
    toDisplayConfig(schema: any) {
      return {
        picker: 'list',
        label: schema.label,
        schemaType: 'list',
        multi: true,
        itemLayout: schema.itemLayout ?? 'inline',
        itemPrefix: schema.itemPrefix ?? '',
      };
    },
    toPickerConfig(schema: any, catalogs: any) {
      return {
        picker: 'list',
        label: schema.label,
        multi: true,
        withCode: catalogs.resolveSchemaWithCode(schema),
        listSource: schema.listSource,
        sourceCollection: schema.sourceCollection,
        sourceLabelField: schema.sourceLabelField,
        schemaType: 'list',
        itemLayout: schema.itemLayout ?? 'inline',
        itemPrefix: schema.itemPrefix ?? '',
        defaultValue: Array.isArray(schema.defaultValue) ? [...schema.defaultValue] : [],
        // Remote lists never use static Option 1 leftovers.
        items:
          schema.listSource === 'remote' || schema.sourceCollection
            ? []
            : catalogs.resolveSchemaItems(schema),
      };
    },
    isEmpty(value: any) {
      return scalarEmpty(value);
    },
  },
  {
    type: 'choice',
    label: 'Choice',
    paletteOrder: 70,
    createSchema(label: any, name: any) {
      return {
        ...baseSchema('choice', label, name),
        multi: false,
        items: [{ id: 'item1', label: 'Option 1' }],
        defaultValue: '',
      };
    },
    getEmptyValue: () => '',
    resolveDefaultValue(schema: any) {
      return schema.defaultValue ?? '';
    },
    toDisplayConfig(schema: any) {
      return {
        picker: 'list',
        label: schema.label,
        schemaType: 'choice',
        multi: schema.multi ?? false,
      };
    },
    toPickerConfig(schema: any, catalogs: any) {
      return {
        picker: 'list',
        label: schema.label,
        multi: schema.multi ?? false,
        withCode: catalogs.resolveSchemaWithCode(schema),
        listSource: schema.listSource,
        sourceCollection: schema.sourceCollection,
        sourceLabelField: schema.sourceLabelField,
        schemaType: 'choice',
        itemLayout: 'inline',
        defaultValue: schema.defaultValue ?? '',
        items:
          schema.listSource === 'remote' || schema.sourceCollection
            ? []
            : catalogs.resolveSchemaItems(schema),
      };
    },
    isEmpty(value: any) {
      return scalarEmpty(value);
    },
  },
  {
    type: 'tree',
    label: 'Tree',
    paletteOrder: 80,
    createSchema(label: any, name: any) {
      return {
        ...baseSchema('tree', label, name),
        tree: [{ label: 'Node 1', children: [{ label: 'Leaf 1' }] }],
        defaultValue: [] as any[],
      };
    },
    getEmptyValue: (): any[] => [],
    resolveDefaultValue(schema: any) {
      return Array.isArray(schema.defaultValue) ? [...schema.defaultValue] : [];
    },
    toDisplayConfig(schema: any) {
      return { picker: 'tree', label: schema.label, schemaType: 'tree', multi: true };
    },
    toPickerConfig(schema: any, catalogs: any) {
      return {
        picker: 'tree',
        label: schema.label,
        tree: catalogs.resolveSchemaTree(schema),
        multi: true,
        defaultValue: Array.isArray(schema.defaultValue) ? [...schema.defaultValue] : [],
      };
    },
    isEmpty(value: any) {
      return scalarEmpty(value);
    },
  },
  {
    type: 'table',
    label: 'Table',
    paletteOrder: 90,
    insertion: 'table',
    createSchema(label: any, name: any) {
      return {
        ...baseSchema('table', label, name),
        columns: [
          { key: 'column_1', label: 'Column 1' },
          { key: 'column_2', label: 'Column 2' },
        ],
        cellType: 'text',
      };
    },
    getEmptyValue: () => ({}),
    resolveDefaultValue() {
      return {};
    },
    toDisplayConfig(schema: any) {
      return { picker: 'text', label: schema.label ?? '' };
    },
    toPickerConfig(schema: any) {
      return { picker: 'text', label: schema.label ?? '' };
    },
  },
  {
    type: 'child',
    label: 'Child',
    paletteOrder: 100,
    createSchema(label: any, name: any) {
      return { ...baseSchema('child', label, name), fieldSchemas: {} };
    },
    getEmptyValue: () => ({}),
    resolveDefaultValue() {
      return {};
    },
    toDisplayConfig(schema: any) {
      return { picker: 'child', label: schema.label, schemaType: 'child' };
    },
    toPickerConfig(schema: any) {
      return { picker: 'child', label: schema.label, schemaType: 'child' };
    },
  },
];

let registered = false;

/** Register all built-in field types (idempotent). */
export function registerBuiltinFields() {
  if (registered) return;
  for (const handler of BUILTIN_HANDLERS) {
    registerField(handler);
  }
  registered = true;
}

registerBuiltinFields();
