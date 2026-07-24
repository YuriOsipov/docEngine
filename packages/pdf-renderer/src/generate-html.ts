import type { EditorDocument, FieldsExport, PdfPageSetup, TemplateExport } from './types.js';
import type { FieldHighlightStyle, FieldValueStyleOptions } from './types.js';
import { ensureDomEnvironment } from './html-environment.js';
import { mergeTemplateAndDocument } from './merge-document.js';

export interface HtmlRenderOptions {
  pageSetup?: PdfPageSetup | Record<string, unknown>;
  fieldValueStyle?: FieldValueStyleOptions | Record<string, unknown>;
  fieldHighlight?: FieldHighlightStyle | Record<string, unknown>;
  /** When true wraps output in a complete HTML page with inline styles. */
  fullDocument?: boolean;
  /** Extra CSS injected into the <style> block (fullDocument mode only). */
  cssOverride?: string;
  /** When true, omit empty fields from HTML output. */
  hideEmptyValues?: boolean;
}

/**
 * Minimal inline CSS that replicates the editor preview styles.
 * Keeps the output self-contained without requiring an external stylesheet.
 */
const PREVIEW_INLINE_CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;padding:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;color:#000;line-height:1.65}
.preview-document{padding:24px;max-width:820px;margin:0 auto}
.preview-document__block{margin-bottom:12px}
.preview-document__line{margin-bottom:4px}
.preview-document__title{font-size:18px;font-weight:bold;margin-bottom:16px}
.preview-document__section{white-space:pre-wrap;word-wrap:break-word;outline:none;min-height:0}
.document-section__header{font-weight:bold;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
.document-section__label-text{font-weight:bold}
.document-columns{margin:0.5em 0}
.document-columns__grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.document-columns__col{min-height:1.5em;white-space:pre-wrap;word-wrap:break-word;color:#000}
.preview-document .document-columns__col{font-family:inherit;font-size:inherit;line-height:inherit;color:inherit}
.field-token{display:inline}
.field-token__repeater-preview{display:block;width:100%}
.field-token__repeater-instance-body .preview-document{padding:0}
.field-token__repeater-instance-empty{color:#888;font-style:italic}
.preview-document .field-token--preview:not(.field-token--image){color:#000;text-decoration:none;cursor:default;font-style:normal}
.preview-document--hide-empty .field-token--preview.field-token--empty:not(.field-token--required-missing){display:none}
.preview-document:not(.preview-document--hide-empty) .field-token--preview.field-token--empty:not(.field-token--repeater),.preview-document .field-token--preview.field-token--required-missing{color:#888;font-style:italic}
.preview-document__empty{color:#666;font-style:italic;margin:0}
.preview-document .document-table{margin-bottom:8px}
.preview-document .vision-table{width:100%;table-layout:fixed;border-collapse:collapse}
.preview-document .vision-table th,.preview-document .vision-table td{border:1px solid #d1d5db;padding:6px 10px;text-align:left;overflow:hidden}
.preview-document .vision-table--borderless th,.preview-document .vision-table--borderless td{border:none}
.preview-document .vision-table th{font-family:inherit;font-size:inherit;font-weight:inherit;font-style:inherit;color:inherit;text-transform:none;letter-spacing:normal;text-align:inherit;background:#f9fafb}
`.trim();

/**
 * Renders an EditorDocument to an HTML string.
 * Requires a DOM environment (browser native or linkedom shim via ensureDomEnvironment).
 */
export async function generateDocumentHtml(
  doc: EditorDocument,
  options: HtmlRenderOptions = {},
): Promise<string> {
  await ensureDomEnvironment();

  // Import after DOM shim is in place so document.createElement is available.
  const { renderDocumentPreview } = await import('@docengine/editor/node');

  const root = renderDocumentPreview(doc as any, {
    pageSetup: options.pageSetup,
    fieldValueStyle: options.fieldValueStyle,
    fieldHighlight: options.fieldHighlight,
    hideEmptyValues: options.hideEmptyValues === true,
  });

  const fragment = root.outerHTML;

  if (!options.fullDocument) return fragment;

  const css = options.cssOverride != null ? options.cssOverride : PREVIEW_INLINE_CSS;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Document</title>
<style>${css}</style>
</head>
<body>${fragment}</body>
</html>`;
}

export interface HtmlGenerateInput {
  template: TemplateExport;
  document: FieldsExport;
  pageSetup?: PdfPageSetup | Record<string, unknown>;
  fieldValueStyle?: FieldValueStyleOptions | Record<string, unknown>;
  fieldHighlight?: FieldHighlightStyle | Record<string, unknown>;
  fullDocument?: boolean;
  cssOverride?: string;
  hideEmptyValues?: boolean;
}

/**
 * Merges a template + document export and renders to HTML.
 */
export async function generateHtmlFromTemplate(input: HtmlGenerateInput): Promise<string> {
  const doc = mergeTemplateAndDocument(input.template, input.document);
  const templatePageSetup = (input.template as any)?.pageSetup ?? {};
  const requestPageSetup = input.pageSetup ?? {};
  return generateDocumentHtml(doc, {
    pageSetup: {
      ...templatePageSetup,
      ...requestPageSetup,
      header: { ...(templatePageSetup as any).header, ...(requestPageSetup as any).header },
      footer: { ...(templatePageSetup as any).footer, ...(requestPageSetup as any).footer },
    },
    fieldValueStyle: input.fieldValueStyle,
    fieldHighlight: input.fieldHighlight,
    fullDocument: input.fullDocument ?? false,
    cssOverride: input.cssOverride,
    hideEmptyValues: input.hideEmptyValues === true,
  });
}
