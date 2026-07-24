/**
 * Ensures a minimal DOM environment exists in globalThis.
 * In the browser this is a no-op (native DOM is already present).
 * In Node, it sets up a linkedom-backed document, Node, DocumentFragment,
 * and DOMParser so that renderDocumentPreview can run server-side.
 *
 * Must be called before any import that uses document.createElement etc.
 */
export async function ensureDomEnvironment(): Promise<void> {
  if (typeof globalThis.document !== 'undefined') return;

  const { parseHTML } = await import('linkedom');
  const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');

  (globalThis as any).document = window.document;
  (globalThis as any).Node = window.Node;
  (globalThis as any).DocumentFragment = window.DocumentFragment;
  (globalThis as any).DOMParser = class {
    parseFromString(markup: string, mimeType?: string) {
      if (mimeType !== 'text/html') {
        return parseHTML('<!DOCTYPE html><html><body></body></html>').document;
      }
      const html = String(markup ?? '');
      const wrapped = /<html[\s>]/i.test(html)
        ? html
        : `<!DOCTYPE html><html><body>${html}</body></html>`;
      return parseHTML(wrapped).document;
    }
  };
}
