/**
 * Sanitize a document title into a filesystem-safe basename.
 */
export function slugifyFilename(name: any, maxLength = 80): string {
  const slug = String(name ?? 'document')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
    .slice(0, maxLength);
  return slug || 'document';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local timestamp: yyyyMMdd-HHmmss */
export function formatFilenameTimestamp(date: Date = new Date()): string {
  return (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
    `-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
  );
}

/** Short random id (6 chars) for collision resistance. */
export function shortFilenameId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export type ExportFilenameFormat = 'html' | 'pdf';

/**
 * Build a suggested export filename.
 * Default: `{slug(title)}_{yyyyMMdd-HHmmss}_{id}.{ext}`
 */
export function buildExportFilename(options: {
  title?: string;
  /** Basename or full name; extension is replaced to match format. */
  baseName?: string;
  format: ExportFilenameFormat;
  /** When true (default), append timestamp + short id. */
  unique?: boolean;
  now?: Date;
  id?: string;
} = { format: 'html' }): string {
  const ext = options.format === 'pdf' ? 'pdf' : 'html';
  const rawBase = options.baseName || options.title || 'document';
  const withoutExt = String(rawBase).replace(/\.(pdf|html|htm)$/i, '');
  const base = slugifyFilename(withoutExt);
  const unique = options.unique !== false;
  if (!unique) {
    return `${base}.${ext}`;
  }
  const stamp = formatFilenameTimestamp(options.now ?? new Date());
  const id = options.id ?? shortFilenameId();
  return `${base}_${stamp}_${id}.${ext}`;
}
