import {
  applyDocumentValues,
  buildDocExport,
  buildDocumentExport,
  isFieldsExport,
  normalizeDocumentValues,
  normalizeTemplateFieldSchemas,
  applyFieldMapping,
  isFieldMappingSpec,
} from '@docengine/engine';
import {
  generateHtmlFromTemplate,
  generatePdfFromTemplate,
} from '@docengine/pdf-renderer';

/**
 * Template JSON (kind: "template") from the document editor.
 * Kept local so n8n does not depend on unpublished editor type aliases.
 */
export type TemplateExport = {
  kind: 'template';
  fieldSchemas?: Record<string, any>;
  blocks?: any[];
  pageSetup?: Record<string, any>;
  fieldMapping?: unknown;
  [key: string]: unknown;
};

export function assertTemplate(template: unknown): TemplateExport {
  if (!template || typeof template !== 'object' || (template as any).kind !== 'template') {
    throw new Error('Invalid template: expected JSON with kind "template", blocks, and fieldSchemas.');
  }
  const t = template as TemplateExport;
  return {
    ...t,
    fieldSchemas: normalizeTemplateFieldSchemas(t.fieldSchemas ?? {}),
  };
}

export function getByPath(path: string, data: Record<string, unknown> | null | undefined): unknown {
  if (path != null && typeof path !== 'string') return undefined;
  const trimmed = String(path ?? '').trim();
  if (!trimmed) return data;

  const parts = trimmed.split('.').filter(Boolean);
  let current: any = data;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Resolve field values from the n8n "Values JSON Path" parameter.
 *
 * n8n may return:
 * - an object (JS / expression mode, or a JSON mapping)
 * - a JSON string of that object
 * - a dot-path into the incoming item (`sections`, `body.values`, …)
 * - empty → use the whole item JSON
 *
 * Previously an object/JSON mapping was treated as a path, missed, and silently
 * fell back to the entire incoming item (so a prior document/PDF payload was
 * rendered instead of the stored template + mapped values).
 */
export function resolveInputValues(
  rawParam: unknown,
  itemJson: Record<string, unknown> | null | undefined,
): unknown {
  const fallback = itemJson ?? {};

  if (rawParam == null) return fallback;

  if (typeof rawParam === 'object') {
    return rawParam;
  }

  if (typeof rawParam !== 'string') {
    return rawParam;
  }

  const str = rawParam.trim();
  if (!str) return fallback;

  if (
    (str.startsWith('{') && str.endsWith('}')) ||
    (str.startsWith('[') && str.endsWith(']'))
  ) {
    try {
      return JSON.parse(str);
    } catch {
      throw new Error(
        'Values JSON is not valid JSON. Use a dot-path (e.g. sections) or a JSON object of field values.',
      );
    }
  }

  const fromPath = getByPath(str, fallback);
  if (fromPath === undefined) {
    throw new Error(`Values JSON Path "${str}" was not found on the incoming item.`);
  }
  return fromPath;
}

export function resolveTemplateFromItem(itemJson: Record<string, unknown>, path = ''): TemplateExport {
  const raw = getByPath(path, itemJson ?? {});
  const template = raw ?? itemJson ?? {};
  if (typeof template === 'string') {
    return assertTemplate(parseJsonText(template));
  }
  return assertTemplate(template);
}

type MergeOptions = {
  applyFieldMappingFromTemplate?: boolean;
  payloadJsonPath?: string;
};

function mergeTemplateWithValues(template: TemplateExport, rawValues: unknown, options: MergeOptions = {}) {
  const blocks = template.blocks ?? [];
  const fieldSchemas = template.fieldSchemas ?? {};

  let sourcePayload = rawValues;
  if (options.applyFieldMappingFromTemplate && isFieldMappingSpec(template.fieldMapping)) {
    const payloadPath = String(options.payloadJsonPath ?? '').trim();
    sourcePayload = payloadPath ? getByPath(payloadPath, (rawValues ?? {}) as Record<string, unknown>) : rawValues;
    const mapped = applyFieldMapping(sourcePayload ?? {}, template.fieldMapping, template);
    rawValues = mapped.fieldsExport;
  }

  const payload =
    rawValues && typeof rawValues === 'object' && isFieldsExport(rawValues)
      ? rawValues
      : rawValues && typeof rawValues === 'object' && (rawValues as any).sections
        ? rawValues
        : rawValues && typeof rawValues === 'object' && (rawValues as any).values
          ? rawValues
          : { values: rawValues ?? {} };

  const values = normalizeDocumentValues(payload, blocks, fieldSchemas);
  return applyDocumentValues(blocks, values, fieldSchemas);
}

type BuildOptions = MergeOptions & { hideEmptyValues?: boolean };

export function buildDocumentExportFromInput(template: TemplateExport, rawValues: unknown, options: BuildOptions = {}) {
  const hideEmptyValues = options.hideEmptyValues === true;
  const merged = mergeTemplateWithValues(template, rawValues, options);

  return buildDocumentExport(
    {
      time: Date.now(),
      fieldSchemas: merged.fieldSchemas,
      blocks: merged.blocks,
      pageSetup: template.pageSetup,
    },
    { hideEmptyValues },
  );
}

export function buildFullDocumentExport(template: TemplateExport, rawValues: unknown, options: BuildOptions = {}) {
  const hideEmptyValues = options.hideEmptyValues === true;
  const fields = buildDocumentExportFromInput(template, rawValues, options);
  const merged = mergeTemplateWithValues(template, rawValues, options);

  const doc = buildDocExport({
    time: Date.now(),
    fieldSchemas: merged.fieldSchemas,
    blocks: merged.blocks,
    pageSetup: template.pageSetup,
  });

  return {
    kind: 'docengine-document',
    version: 1,
    time: Date.now(),
    hideEmptyValues,
    template,
    fields,
    doc,
    /** @deprecated Use `fields` */
    document: fields,
  };
}

type RenderOptions = BuildOptions & { outputFormat?: 'html' | 'pdf' };

export async function renderDocument(template: TemplateExport, rawValues: unknown, options: RenderOptions = {}) {
  const hideEmptyValues = options.hideEmptyValues === true;
  const outputFormat = options.outputFormat === 'pdf' ? 'pdf' : 'html';
  const document = buildDocumentExportFromInput(template, rawValues, options);

  if (outputFormat === 'pdf') {
    const data = await generatePdfFromTemplate({
      template,
      document,
      hideEmptyValues,
    });
    return { mimeType: 'application/pdf', fileExtension: 'pdf', data };
  }

  const html = await generateHtmlFromTemplate({
    template,
    document,
    fullDocument: true,
    hideEmptyValues,
  });
  return {
    mimeType: 'text/html',
    fileExtension: 'html',
    data: Buffer.from(html, 'utf8'),
  };
}

export function parseJsonText(raw: string): unknown {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Template JSON is empty.');
  }
  return JSON.parse(raw);
}
