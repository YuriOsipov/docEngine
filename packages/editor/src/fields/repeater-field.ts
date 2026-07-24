import { renderDocumentPreview } from './document-preview.js';
import {
  normalizeRepeaterValue,
  buildRepeaterFillDocument,
  repeaterHasContent,
  repeaterHasTemplate,
} from '../core/repeater-io.js';
import { getRegistryFromConfig } from '../registry/registry-context.js';

export function getRepeaterSchema(repeaterId: any, options: any = {}) {
  if (options.fieldSchemas?.[repeaterId]) {
    return options.fieldSchemas[repeaterId];
  }
  const registry = options.getRegistry?.() ?? getRegistryFromConfig(options);
  return registry?.getFieldSchemas()?.[repeaterId] ?? null;
}

/**
 * Multi-line inline preview for a single repeater field token.
 * @param {string} repeaterId
 * @param {import('../types.d.ts').RepeaterValue} repeaterValue
 * @param {object} options
 */
export function renderRepeaterFieldPreview(repeaterId: any, repeaterValue: any, options: any = {}) {
  const repeaterSchema = getRepeaterSchema(repeaterId, options);
  const wrapper = document.createElement('span');
  wrapper.className = 'field-token__repeater-preview';

  if (!repeaterSchema || repeaterSchema.type !== 'child') {
    wrapper.textContent = 'Repeater schema not found.';
    return wrapper;
  }

  const normalized = normalizeRepeaterValue(repeaterValue, repeaterSchema);
  const body = document.createElement('div');
  body.className = 'field-token__repeater-instance-body';

  const hasTemplate = repeaterHasTemplate(repeaterSchema);

  if (!repeaterHasContent(normalized, repeaterSchema) && !hasTemplate) {
    const empty = document.createElement('div');
    empty.className = 'field-token__repeater-instance-empty';
    empty.textContent = '(empty)';
    body.appendChild(empty);
  } else {
    const doc = buildRepeaterFillDocument(repeaterSchema, normalized);
    body.appendChild(
      renderDocumentPreview(doc, {
        fieldValueStyle: options.fieldValueStyle,
        hideEmptyValues: options.hideEmptyValues === true,
      }),
    );
  }

  wrapper.appendChild(body);
  return wrapper;
}

export function createInlineRepeaterSeedValue(repeaterSchema: any) {
  return normalizeRepeaterValue({}, repeaterSchema);
}
