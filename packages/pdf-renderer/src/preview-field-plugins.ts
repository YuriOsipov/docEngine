import { formatDateValue } from '@docengine/engine';
import { getFieldHandler, registerField } from '@docengine/editor/node';

/**
 * Server/HTML preview has no Salesforce LWC plugin load. Register a date
 * display handler so PDF/HTML match the editor (dd/mm/yyyy instead of ISO).
 */
export function ensurePreviewFieldPlugins() {
  if (getFieldHandler('date')) return;

  registerField({
    type: 'date',
    label: 'Date',
    createSchema(label: string, name: string) {
      return { type: 'date', label, name: name || label };
    },
    getEmptyValue: () => '',
    resolveDefaultValue: () => '',
    toDisplayConfig(schema: { label?: string }) {
      return { picker: 'date', label: schema.label };
    },
    toPickerConfig(schema: { label?: string }) {
      return { picker: 'date', label: schema.label };
    },
    formatDisplay(value: unknown, { emptyLabel, schema }: { emptyLabel?: string; schema?: any }) {
      if (value == null || value === '') return emptyLabel ?? '';
      return formatDateValue(value, schema?.dateFormat, {
        customDateFormat: schema?.customDateFormat,
      });
    },
    isEmpty(value: unknown) {
      return value == null || value === '';
    },
    pdfRenderMode: () => 'plain' as const,
  });
}
