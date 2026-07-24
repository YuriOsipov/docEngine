import { formatDateValue, looksLikeDateFormatSuffix } from './date-format.js';
import {
  formatCurrencyValue,
  looksLikeCurrencyFormatSuffix,
} from './currency-format.js';

/**
 * Apply a mapping `#suffix` transform (currency or date) to a resolved value.
 * Returns the original value when the suffix is unrecognized.
 */
export function applyMappingFormatSuffix(value: unknown, format: string | null | undefined): unknown {
  const raw = String(format ?? '').trim();
  if (!raw) return value;

  // Date presets first so `#iso` is never treated as a currency code.
  if (looksLikeDateFormatSuffix(raw)) {
    return formatDateValue(value, raw);
  }
  if (looksLikeCurrencyFormatSuffix(raw)) {
    return formatCurrencyValue(value, raw);
  }
  return value;
}

export function looksLikeMappingFormatSuffix(format: string): boolean {
  const raw = String(format ?? '').trim();
  if (!raw) return false;
  return looksLikeCurrencyFormatSuffix(raw) || looksLikeDateFormatSuffix(raw);
}
