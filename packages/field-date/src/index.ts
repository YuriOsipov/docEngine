import type { FieldHandler } from '@docengine/editor';
import { dateFieldHandler } from './date-field-handler.js';

export {
  dateFieldHandler,
  formatDateValue,
  applyCustomDatePattern,
  DEFAULT_DATE_FORMAT,
  DEFAULT_CUSTOM_DATE_FORMAT,
  type DateDisplayFormat,
  type FormatDateValueOptions,
} from './date-field-handler.js';
export {
  createDateModal,
  createDatePickerCallbacks,
  type DateModal,
  type DateModalOpenOptions,
  type DatePickerCallbacks,
} from './date-modal.js';

export interface RegisterDateFieldApi {
  registerField: (handler: FieldHandler) => FieldHandler | unknown;
}

/**
 * Register the date field handler with DocEngine.
 *
 * Pass `{ registerField }` from `@docengine/editor` so this package does not
 * need a hard circular import of the editor at module load time.
 *
 * @example
 * import { registerField, createEditor } from '@docengine/editor';
 * import { registerDateField, createDatePickerCallbacks } from '@docengine/field-date';
 *
 * registerDateField({ registerField });
 * createEditor({
 *   holder: '#editor',
 *   pickers: createDatePickerCallbacks(),
 * });
 */
export function registerDateField(api: RegisterDateFieldApi): FieldHandler | unknown {
  if (typeof api?.registerField !== 'function') {
    throw new Error('registerDateField: pass { registerField } from @docengine/editor');
  }
  return api.registerField(dateFieldHandler);
}
