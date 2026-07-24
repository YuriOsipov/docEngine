/**
 * Field handler registry — plugins register field types here instead of
 * hardcoding switches across the editor.
 */
import type { FieldHandler } from '../../types.js';

export type { FieldHandler };

const handlers = new Map<string, FieldHandler>();

/**
 * Register a field type plugin. Replaces an existing handler of the same type.
 */
export function registerField(handler: any): FieldHandler {
  if (!handler || typeof handler.type !== 'string' || !handler.type) {
    throw new Error('registerField: handler.type is required');
  }
  if (typeof handler.createSchema !== 'function') {
    throw new Error(`registerField(${handler.type}): createSchema is required`);
  }
  if (typeof handler.getEmptyValue !== 'function') {
    throw new Error(`registerField(${handler.type}): getEmptyValue is required`);
  }
  if (typeof handler.resolveDefaultValue !== 'function') {
    throw new Error(`registerField(${handler.type}): resolveDefaultValue is required`);
  }
  if (typeof handler.toDisplayConfig !== 'function') {
    throw new Error(`registerField(${handler.type}): toDisplayConfig is required`);
  }
  if (typeof handler.toPickerConfig !== 'function') {
    throw new Error(`registerField(${handler.type}): toPickerConfig is required`);
  }

  const normalized: FieldHandler = {
    paletteOrder: 100,
    insertion: 'inline',
    editableInFill: true,
    blockLabel: handler.label ?? handler.type,
    ...handler,
  };
  handlers.set(normalized.type, normalized);
  return normalized;
}

export function getFieldHandler(type: string): FieldHandler | undefined {
  return handlers.get(type);
}

export function hasFieldHandler(type: string): boolean {
  return handlers.has(type);
}

export function listFieldHandlers(): FieldHandler[] {
  return [...handlers.values()].sort(
    (a, b) => (a.paletteOrder ?? 100) - (b.paletteOrder ?? 100) || a.type.localeCompare(b.type),
  );
}

/** Palette entries for registered field types. */
export function getFieldTypes(): Array<{ kind: 'field'; type: string; label: string }> {
  return listFieldHandlers().map((h) => ({
    kind: 'field' as const,
    type: h.type,
    label: h.label,
  }));
}

/** Field types inserted inline into a document section (not table / templateBlock). */
export function getInlineFieldTypes(): string[] {
  return listFieldHandlers()
    .filter((h) => (h.insertion ?? 'inline') === 'inline')
    .map((h) => h.type);
}

export function isInlineFieldType(type: string): boolean {
  const h = handlers.get(type);
  return !!h && (h.insertion ?? 'inline') === 'inline';
}

/** Remove a field handler (mainly for tests). */
export function unregisterField(type: string): boolean {
  return handlers.delete(type);
}

/** Clear all handlers (tests only). */
export function clearFieldHandlers(): void {
  handlers.clear();
}
