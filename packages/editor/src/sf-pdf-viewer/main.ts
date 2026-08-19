/**
 * Runs inside DocEnginePdfViewer Static Resource (not under LWC/LWS).
 * Parent posts { type: 'docengine-pdf', base64 }.
 * Show those bytes with the browser native PDF plugin (same as Downloads).
 */
const statusEl = document.getElementById('status');
const embedEl = document.getElementById('embed') as HTMLEmbedElement | null;

let objectUrl: string | null = null;

function setStatus(text: string) {
  if (!statusEl) return;
  statusEl.hidden = !text;
  statusEl.textContent = text || '';
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    data[i] = binary.charCodeAt(i);
  }
  return data;
}

function showNativePdf(base64: string) {
  const bytes = base64ToBytes(base64);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(blob);

  if (embedEl) {
    embedEl.hidden = false;
    embedEl.setAttribute('src', objectUrl);
    setStatus('');
    return;
  }
  window.location.replace(objectUrl);
}

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg) return;
  if (msg.type === 'docengine-pdf-ping') {
    window.parent.postMessage({ type: 'docengine-pdf-ready' }, '*');
    return;
  }
  if (msg.type !== 'docengine-pdf' || typeof msg.base64 !== 'string') return;
  try {
    setStatus('Loading PDF…');
    showNativePdf(msg.base64);
  } catch (err: any) {
    setStatus(err?.message || String(err) || 'PDF preview failed.');
  }
});

window.parent.postMessage({ type: 'docengine-pdf-ready' }, '*');
