/**
 * Freeze contract for the LWC static-resource bundle.
 *
 * Static Resource "DocEngineBundle" → `packages/editor/dist/editor-lwc.js`
 * (IIFE from `npm run build:sf`) must expose `window.DocEditor` with at least:
 *   - createEditor(options) → editor instance
 *
 * Editor instance methods used by Salesforce hosts:
 *   - ready, destroy(), setDesignMode(), load()
 *   - exportDoc(), exportFields(), exportTemplate()
 *   - getFieldMapping(), setFieldMapping(), applyFieldMapping(), openFieldMapping()
 *   - validate() (optional)
 *   - exportDocument() is a deprecated alias of exportFields()
 *
 * Keep this file as Salesforce-consumable `.js` (LWC default).
 * Type the host bridge here without changing the published controller.
 */

export interface DocEditorCreateOptions {
  holder: HTMLElement | string;
  data?: Record<string, unknown>;
  catalogs?: { lists?: Record<string, unknown>; trees?: Record<string, unknown> };
  ui?: {
    designLayout?: string;
    chromeParent?: HTMLElement | string;
    documentActionsContainer?: HTMLElement | string;
    stickyChrome?: boolean;
  };
  fieldValueStyle?: {
    default?: Record<string, string>;
  };
  resolveListItems?: (opts: {
    fieldName: string;
    query: string;
    signal: AbortSignal;
  }) => Promise<unknown[]>;
  onChange?: (doc: Record<string, unknown>) => void;
}

export interface DocEditorInstance {
  ready: Promise<void>;
  destroy(): void;
  setDesignMode(enabled: boolean): void | Promise<void>;
  exportDoc(): Promise<Record<string, unknown>>;
  exportFields(options?: Record<string, unknown>): Promise<Record<string, unknown>>;
  /** @deprecated Use exportFields() */
  exportDocument(options?: Record<string, unknown>): Promise<Record<string, unknown>>;
  load(data: Record<string, unknown>): void | Promise<void>;
}

export interface DocEditorGlobal {
  createEditor(options: DocEditorCreateOptions): DocEditorInstance;
}

declare global {
  interface Window {
    DocEditor?: DocEditorGlobal;
  }
}

export {};
