const FILE_TYPES = {
  'application/json': { description: 'JSON file', extensions: ['.json'] },
  'application/pdf': { description: 'PDF document', extensions: ['.pdf'] },
  'text/html': { description: 'HTML document', extensions: ['.html', '.htm'] },
};

/**
 * Save a blob via the native system save dialog when supported, otherwise trigger a download.
 * @param {Blob} blob
 * @param {string} suggestedFilename
 * @param {string} mimeType
 * @returns {Promise<boolean>} true if saved, false if cancelled
 */
export async function saveBlobToDisk(blob: any,suggestedFilename: any,mimeType: any) {
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const preset = FILE_TYPES[mimeType];
      const handle = await window.showSaveFilePicker({
        suggestedName: suggestedFilename,
        types: preset
          ? [{ description: preset.description, accept: { [mimeType]: preset.extensions } }]
          : [{ description: 'File', accept: { [mimeType]: [] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError') return false;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedFilename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
