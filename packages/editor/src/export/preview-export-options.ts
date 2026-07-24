/**
 * Shared options for Simple preview and PDF export so both renderers stay aligned.
 * @param {import('../types.js').EditorDocument} doc
 * @param {import('../types.js').PdfExportOptions & { pageSetup?: import('../types.js').TemplatePageSetup; pdfTitle?: string }} [editorOptions]
 * @param {{ pdfTitle?: string; getPageSetup?: () => import('../types.js').TemplatePageSetup | undefined }} [ui]
 */
export function resolvePreviewExportOptions(doc: any,editorOptions: any = {},ui: any = {}) {
  const docPageSetup = doc?.pageSetup ?? ui.getPageSetup?.() ?? {};
  const optionsPageSetup = editorOptions.pageSetup ?? {};
  const mergedPageSetup = {
    ...docPageSetup,
    ...optionsPageSetup,
    format: editorOptions.format ?? optionsPageSetup.format ?? docPageSetup.format,
    margin: editorOptions.margin ?? optionsPageSetup.margin ?? docPageSetup.margin,
    title: editorOptions.title ?? optionsPageSetup.title ?? docPageSetup.title ?? ui.pdfTitle,
  };

  return {
    pageSetup: mergedPageSetup,
    title: editorOptions.title ?? mergedPageSetup.title,
    format: mergedPageSetup.format,
    margin: mergedPageSetup.margin,
    fieldValueStyle: editorOptions.fieldValueStyle,
    fieldHighlight:
      editorOptions.fieldHighlight ?? optionsPageSetup.fieldHighlight ?? docPageSetup.fieldHighlight,
    fonts: editorOptions.fonts,
    hideEmptyValues: editorOptions.hideEmptyValues === true,
  };
}
