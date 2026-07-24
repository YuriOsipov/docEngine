/**
 * Runs inside DocEnginePdfViewer Static Resource (not under LWC/LWS).
 * Parent Lightning page posts: { type: 'docengine-pdf', base64: '...' }
 */
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.js', window.location.href).href;

const statusEl = document.getElementById('status');
const pagesEl = document.getElementById('pages');

function setStatus(text: string) {
  if (!statusEl) return;
  statusEl.hidden = !text;
  statusEl.textContent = text || '';
}

async function renderBase64(base64: string) {
  setStatus('Rendering PDF…');
  if (pagesEl) pagesEl.innerHTML = '';

  const binary = atob(base64);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    data[i] = binary.charCodeAt(i);
  }

  const pdf = await getDocument({ data }).promise;
  setStatus('');

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.25 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.setAttribute('aria-label', `PDF page ${pageNum}`);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    await page.render({ canvasContext: ctx, viewport }).promise;
    pagesEl?.appendChild(canvas);
  }
}

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg) return;
  if (msg.type === 'docengine-pdf-ping') {
    window.parent.postMessage({ type: 'docengine-pdf-ready' }, '*');
    return;
  }
  if (msg.type !== 'docengine-pdf' || typeof msg.base64 !== 'string') return;
  renderBase64(msg.base64).catch((err) => {
    setStatus(err?.message || String(err) || 'PDF render failed.');
  });
});

window.parent.postMessage({ type: 'docengine-pdf-ready' }, '*');
