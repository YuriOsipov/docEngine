/** Shared date display formatting (ISO storage → display string). */

export type DateDisplayFormat = 'iso' | 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'd mmm yyyy' | 'custom';

export const DEFAULT_DATE_FORMAT: DateDisplayFormat = 'dd/mm/yyyy';
export const DEFAULT_CUSTOM_DATE_FORMAT = 'DD/MM/YYYY';

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const PRESET_FORMATS = new Set<string>([
  'iso',
  'yyyy-mm-dd',
  'dd/mm/yyyy',
  'mm/dd/yyyy',
  'd mmm yyyy',
  'custom',
]);

export type DateParts = { y: number; m: number; d: number };

function scalarEmpty(value: unknown): boolean {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}

/**
 * Parse ISO date (`YYYY-MM-DD`) or datetime (`YYYY-MM-DDTHH:mm:ss…`) into parts.
 * Uses the calendar date portion (not timezone-shifted).
 */
export function parseDateParts(value: unknown): DateParts | null {
  if (scalarEmpty(value)) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      y: value.getFullYear(),
      m: value.getMonth() + 1,
      d: value.getDate(),
    };
  }

  const str = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(str);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** Normalize to ISO date string `YYYY-MM-DD`, or null if not parseable. */
export function toIsoDateString(value: unknown): string | null {
  const parts = parseDateParts(value);
  if (!parts) return null;
  const mm = String(parts.m).padStart(2, '0');
  const dd = String(parts.d).padStart(2, '0');
  return `${parts.y}-${mm}-${dd}`;
}

/** Apply a custom pattern using tokens: YYYY YY MMMM MMM MM M DD D. */
export function applyCustomDatePattern(parts: DateParts, pattern: string): string {
  const dd = String(parts.d).padStart(2, '0');
  const mm = String(parts.m).padStart(2, '0');
  const yyyy = String(parts.y);
  const yy = yyyy.slice(-2);
  const tokens: [string, string][] = [
    ['YYYY', yyyy],
    ['MMMM', MONTH_LONG[parts.m - 1]!],
    ['MMM', MONTH_SHORT[parts.m - 1]!],
    ['YY', yy],
    ['MM', mm],
    ['DD', dd],
    ['M', String(parts.m)],
    ['D', String(parts.d)],
  ];

  let result = '';
  let i = 0;
  const src = pattern;
  while (i < src.length) {
    let matched = false;
    for (const [token, replacement] of tokens) {
      if (src.startsWith(token, i)) {
        result += replacement;
        i += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += src[i];
      i += 1;
    }
  }
  return result;
}

export type FormatDateValueOptions = {
  customDateFormat?: string | null;
};

function normalizePresetFormat(format: unknown): DateDisplayFormat | null {
  const raw = String(format ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'yyyy-mm-dd') return 'iso';
  if (
    raw === 'iso' ||
    raw === 'dd/mm/yyyy' ||
    raw === 'mm/dd/yyyy' ||
    raw === 'd mmm yyyy' ||
    raw === 'custom'
  ) {
    return raw;
  }
  return null;
}

/**
 * Format a date/datetime value for display.
 * Known presets: iso, dd/mm/yyyy, mm/dd/yyyy, d mmm yyyy.
 * Unknown patterns are treated as custom token patterns (YYYY MM DD …).
 */
export function formatDateValue(
  value: unknown,
  format: unknown = DEFAULT_DATE_FORMAT,
  options: FormatDateValueOptions | string = {},
): string {
  if (scalarEmpty(value)) return '';
  const parts = parseDateParts(value);
  if (!parts) return String(value);

  const opts: FormatDateValueOptions =
    typeof options === 'string' ? { customDateFormat: options } : (options ?? {});

  const rawFormat = String(format ?? '').trim();
  const preset = normalizePresetFormat(rawFormat);
  const dd = String(parts.d).padStart(2, '0');
  const mm = String(parts.m).padStart(2, '0');
  const yyyy = String(parts.y);

  if (preset === 'iso') return `${yyyy}-${mm}-${dd}`;
  if (preset === 'mm/dd/yyyy') return `${mm}/${dd}/${yyyy}`;
  if (preset === 'd mmm yyyy') return `${parts.d} ${MONTH_SHORT[parts.m - 1]} ${yyyy}`;
  if (preset === 'dd/mm/yyyy') return `${dd}/${mm}/${yyyy}`;

  // `custom` preset uses options.customDateFormat; any other string is a literal pattern.
  const pattern =
    preset === 'custom'
      ? String(opts.customDateFormat ?? '').trim() || DEFAULT_CUSTOM_DATE_FORMAT
      : rawFormat || DEFAULT_CUSTOM_DATE_FORMAT;
  return applyCustomDatePattern(parts, pattern);
}

export type ParsedMappingSourcePath = {
  /** Path without `#format` suffix. */
  path: string;
  /** Format after `#`, or null when absent. */
  dateFormat: string | null;
};

/**
 * Split `$payload.CreatedDate#dd/mm/yyyy` into path + format.
 * Uses the last `#` so paths themselves should not contain `#`.
 */
export function parseMappingSourcePath(sourcePath: unknown): ParsedMappingSourcePath {
  const trimmed = String(sourcePath ?? '').trim();
  if (!trimmed) return { path: '', dateFormat: null };

  const hash = trimmed.lastIndexOf('#');
  if (hash <= 0) return { path: trimmed, dateFormat: null };

  // Avoid treating bare `#format` or fragment-only as a path.
  const path = trimmed.slice(0, hash).trim();
  const dateFormat = trimmed.slice(hash + 1).trim();
  if (!path || !dateFormat) return { path: trimmed, dateFormat: null };

  // Don't treat `#` inside accidental JS comments / invalid paths with leading $
  // as format when there is no plausible path segment (e.g. empty before #).
  return { path, dateFormat };
}

/** True when `format` looks like a date format suffix (preset or token pattern). */
export function looksLikeDateFormatSuffix(format: string): boolean {
  const raw = String(format ?? '').trim();
  if (!raw) return false;
  if (PRESET_FORMATS.has(raw.toLowerCase())) return true;
  // Custom patterns must include at least one date token.
  return /Y{2,4}|M{1,4}|D{1,2}/.test(raw);
}
