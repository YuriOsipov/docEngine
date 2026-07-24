import type { ImageValue } from '../types.js';

export function createEmptyImageValue(): ImageValue {
  return { url: '', caption: '' };
}

export function normalizeImageValue(value: unknown): ImageValue {
  if (!value) return createEmptyImageValue();
  if (typeof value === 'string') {
    return value ? { url: value, caption: '' } : createEmptyImageValue();
  }
  if (typeof value === 'object') {
    const obj = value as { url?: string; caption?: string; file?: { url?: string } };
    return {
      url: obj.url ?? obj.file?.url ?? '',
      caption: obj.caption ?? '',
    };
  }
  return createEmptyImageValue();
}

export function isImageValueEmpty(value: unknown): boolean {
  const normalized = normalizeImageValue(value);
  return !normalized.url;
}
