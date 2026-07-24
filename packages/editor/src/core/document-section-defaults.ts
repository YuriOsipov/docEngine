/** Default empty document section used when the editor has no sections. */
export function createEmptyDocumentSectionBlock() {
  return {
    type: 'documentSection',
    data: {
      name: '',
      label: '',
      collapsed: false,
      repeatable: false,
      hideTitleInPreview: false,
      segments: [],
      fieldValues: {},
    },
  };
}

export function countDocumentSections(blocks) {
  return (blocks ?? []).filter((block) => block?.type === 'documentSection').length;
}

/**
 * Ensure the document always has at least one `documentSection`.
 * @param {Array<{ type: string, data?: object }>} blocks
 * @returns {Array<{ type: string, data?: object }>}
 */
export function ensureAtLeastOneDocumentSection(blocks) {
  const list = Array.isArray(blocks) ? [...blocks] : [];
  if (countDocumentSections(list) === 0) {
    list.unshift(createEmptyDocumentSectionBlock());
  }
  return list;
}
