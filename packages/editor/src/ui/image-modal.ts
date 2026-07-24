import { uploadByFile, uploadByUrl, normalizeImageValue, createEmptyImageValue } from '../services/image-upload.js';
import { wireModalEscape } from './wire-modal-escape.js';
import {
  FIELD_MODAL_FOOTER_HINT_HTML,
  FIELD_MODAL_OVERLAY_CLASS,
  mountFieldModalOverlay,
  wireModalConfirmShortcut,
} from './wire-modal-palette.js';

export function createImageModal({ parent = null }: { parent?: HTMLElement | null } = {}) {
  const overlay = document.createElement('div');
  overlay.className = FIELD_MODAL_OVERLAY_CLASS;
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="modal modal--wide" role="dialog" aria-modal="true">
      <div class="modal__header"></div>
      <div class="modal__body image-modal">
        <div class="image-modal__preview" data-role="preview" hidden>
          <img alt="" data-role="preview-img" />
        </div>
        <label class="schema-form__row">
          <span>Upload file</span>
          <input type="file" accept="image/*" data-role="file" />
        </label>
        <label class="schema-form__row">
          <span>Or image URL</span>
          <input type="url" class="modal__input" data-role="url" placeholder="https://..." />
        </label>
        <label class="schema-form__row">
          <span>Caption</span>
          <input type="text" class="modal__input" data-role="caption" placeholder="Optional caption" />
        </label>
        <p class="modal__error" data-role="error" hidden></p>
        <p class="modal__hint" data-role="status"></p>
      </div>
      <div class="modal__footer">
        <button type="button" class="btn" data-action="clear">Clear</button>
        <button type="button" class="btn btn-primary" data-action="ok">OK</button>
        ${FIELD_MODAL_FOOTER_HINT_HTML}
        <button type="button" class="btn" data-action="close">Close</button>
      </div>
    </div>
  `;

  mountFieldModalOverlay(overlay, parent);

  const header = overlay.querySelector('.modal__header');
  const preview = overlay.querySelector('[data-role="preview"]');
  const previewImg = overlay.querySelector('[data-role="preview-img"]');
  const fileInput = overlay.querySelector('[data-role="file"]');
  const urlInput = overlay.querySelector('[data-role="url"]');
  const captionInput = overlay.querySelector('[data-role="caption"]');
  const errorEl = overlay.querySelector('[data-role="error"]');
  const statusEl = overlay.querySelector('[data-role="status"]');
  const btnOk = overlay.querySelector('[data-action="ok"]');
  const btnClose = overlay.querySelector('[data-action="close"]');
  const btnClear = overlay.querySelector('[data-action="clear"]');

  let resolvePromise: any = null;
  let rejectPromise: any = null;
  let _currentValue = createEmptyImageValue();
  
  let pendingUrl = '';

  function close() {
    overlay.hidden = true;
    fileInput.value = '';
    urlInput.value = '';
    errorEl.hidden = true;
    errorEl.textContent = '';
    statusEl.textContent = '';
    pendingUrl = '';
  }

  function showError(message: any) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function updatePreview(url: any) {
    if (url) {
      previewImg.src = url;
      preview.hidden = false;
    } else {
      previewImg.removeAttribute('src');
      preview.hidden = true;
    }
  }

  function setFormFromValue(value: any) {
    const normalized = normalizeImageValue(value);
    _currentValue = normalized;
    pendingUrl = normalized.url;
    captionInput.value = normalized.caption ?? '';
    urlInput.value = '';
    updatePreview(normalized.url);
  }

  async function uploadSelectedFile() {
    const file = fileInput.files?.[0];
    if (!file) return false;

    showError('');
    statusEl.textContent = 'Uploading…';
    btnOk.disabled = true;

    try {
      const result = await uploadByFile(file);
      pendingUrl = result.file.url;
      _currentValue = { url: pendingUrl, caption: captionInput.value.trim() };
      updatePreview(pendingUrl);
      statusEl.textContent = 'Upload complete.';
      fileInput.value = '';
      return true;
    } catch (err: any) {
      showError(err.message ?? 'Upload failed');
      statusEl.textContent = '';
      return false;
    } finally {
      btnOk.disabled = false;
    }
  }

  async function uploadFromUrlField() {
    const url = urlInput.value.trim();
    if (!url) return false;

    showError('');
    statusEl.textContent = 'Uploading from URL…';
    btnOk.disabled = true;

    try {
      const result = await uploadByUrl(url);
      pendingUrl = result.file.url;
      _currentValue = { url: pendingUrl, caption: captionInput.value.trim() };
      updatePreview(pendingUrl);
      statusEl.textContent = 'Upload complete.';
      urlInput.value = '';
      return true;
    } catch (err: any) {
      showError(err.message ?? 'Upload failed');
      statusEl.textContent = '';
      return false;
    } finally {
      btnOk.disabled = false;
    }
  }

  async function submit() {
    if (fileInput.files?.[0]) {
      const ok = await uploadSelectedFile();
      if (!ok) return;
    } else if (urlInput.value.trim()) {
      const ok = await uploadFromUrlField();
      if (!ok) return;
    }

    const result = {
      url: pendingUrl,
      caption: captionInput.value.trim(),
    };

    const resolve = resolvePromise;
    close();
    resolve?.(result);
    resolvePromise = null;
    rejectPromise = null;
  }

  function open({ title, value = null }: any) {
    return new Promise((resolve: any,reject: any) => {
      resolvePromise = resolve;
      rejectPromise = reject;
      header.textContent = title;
      setFormFromValue(value);
      mountFieldModalOverlay(overlay, parent);
      overlay.hidden = false;
      captionInput.focus();
    });
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      updatePreview(URL.createObjectURL(file));
      showError('');
    }
  });

  btnOk.addEventListener('click', () => submit());

  btnClear.addEventListener('click', () => {
    const resolve = resolvePromise;
    close();
    resolve?.(createEmptyImageValue());
    resolvePromise = null;
    rejectPromise = null;
  });

  btnClose.addEventListener('click', () => {
    rejectPromise?.(new Error('cancelled'));
    resolvePromise = null;
    rejectPromise = null;
    close();
  });

  overlay.addEventListener('click', (e: any) => {
    if (e.target === overlay) btnClose.click();
  });

  wireModalConfirmShortcut(overlay, btnOk);
  wireModalEscape(overlay, () => btnClose.click());

  return { open };
}
