/**
 * Salesforce Static Resource entry (vite.config.sf.js).
 * Re-exports the editor API plus ophthalmology domain catalogs used by
 * templates that reference commonListId / commonTreeId.
 *
 * Registers `@docengine/field-date` so Date appears in the DocEngine palette
 * (date is intentionally not built into the core editor).
 */
import { registerField } from './index.js';
import {
  registerDateField,
  createDatePickerCallbacks,
} from '@docengine/field-date';

registerDateField({ registerField });

export * from './index.js';
export { ophthalmologyCatalogs } from './domain/ophthalmology/catalogs.js';
export { createDatePickerCallbacks };
