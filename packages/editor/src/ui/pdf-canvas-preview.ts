/**
 * Render PDF in Salesforce via Static Resource viewer iframe (LWS-safe).
 * Parent posts original PDF base64; the viewer uses the browser native PDF plugin.
 */

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read PDF.'));
    reader.readAsDataURL(blob);
  });
}

function resolveViewerUrl(explicit?: string | null) {
  if (explicit) return explicit;
  if (typeof window !== 'undefined' && (window as any).__DOCENGINE_PDF_VIEWER_URL__) {
    return String((window as any).__DOCENGINE_PDF_VIEWER_URL__);
  }
  return null;
}

/**
 * @param {HTMLElement} container
 * @param {Blob} blob
 * @param {{ scale?: number, viewerUrl?: string }} [opts]
 */
export async function renderPdfBlobToContainer(container: any, blob: any, opts: any = {}) {
  const viewerUrl = resolveViewerUrl(opts.viewerUrl);
  if (!viewerUrl) {
    throw new Error(
      'PDF viewer URL is not configured. Deploy DocEnginePdfViewer and set window.__DOCENGINE_PDF_VIEWER_URL__.',
    );
  }

  const base64 = await blobToBase64(blob);

  await new Promise<void>((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.className = 'preview-modal__pdf preview-modal__pdf--viewer';
    iframe.title = 'Document PDF preview';
    iframe.setAttribute('allow', 'fullscreen');

    let settled = false;
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('PDF viewer timed out.'));
    }, 60000);

    function cleanup() {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== iframe.contentWindow) return;
      const msg = event.data;
      if (!msg || msg.type !== 'docengine-pdf-ready') return;
      try {
        iframe.contentWindow?.postMessage({ type: 'docengine-pdf', base64 }, '*');
        cleanup();
        resolve();
      } catch (err) {
        cleanup();
        reject(err);
      }
    }

    window.addEventListener('message', onMessage);
    iframe.addEventListener('load', () => {
      // Ready message may arrive before or after load; also nudge if already ready.
      try {
        iframe.contentWindow?.postMessage({ type: 'docengine-pdf-ping' }, '*');
      } catch {
        /* ignore */
      }
    });
    iframe.addEventListener('error', () => {
      cleanup();
      reject(new Error('Failed to load PDF viewer.'));
    });

    container.innerHTML = '';
    container.appendChild(iframe);
    iframe.src = viewerUrl;
  });
}
