import { listExistingImages, resolveExistingImage } from '../services/image-upload.js';
import { wireModalEscape } from './wire-modal-escape.js';
import {
  FIELD_MODAL_OVERLAY_CLASS,
  mountFieldModalOverlay,
} from './wire-modal-palette.js';

/**
 * Secondary picker: choose an existing host image File (e.g. Salesforce Files on the record).
 * Returns { url, name } or rejects with Error('cancelled').
 */
export function createExistingImageModal({ parent = null }: { parent?: HTMLElement | null } = {}) {
  const overlay = document.createElement('div');
  overlay.className = `${FIELD_MODAL_OVERLAY_CLASS} image-files-modal-overlay`;
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="image-files-modal-title">
      <div class="modal__header" id="image-files-modal-title">Choose from Salesforce Files</div>
      <div class="modal__body image-files-modal">
        <p class="modal__hint" data-role="hint">Select a File linked to this record.</p>
        <div class="image-modal__existing-list" data-role="list" role="listbox"></div>
        <p class="modal__error" data-role="error" hidden></p>
      </div>
      <div class="modal__footer">
        <button type="button" class="btn" data-action="close">Cancel</button>
      </div>
    </div>
  `;

  mountFieldModalOverlay(overlay, parent);

  const hintEl = overlay.querySelector('[data-role="hint"]');
  const listEl = overlay.querySelector('[data-role="list"]');
  const errorEl = overlay.querySelector('[data-role="error"]');
  const btnClose = overlay.querySelector('[data-action="close"]');

  let resolvePromise: any = null;
  let rejectPromise: any = null;
  let busy = false;

  function showError(message: any) {
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }

  function close() {
    overlay.hidden = true;
    listEl.innerHTML = '';
    hintEl.textContent = '';
    showError('');
    busy = false;
  }

  function cancel() {
    const reject = rejectPromise;
    close();
    resolvePromise = null;
    rejectPromise = null;
    reject?.(new Error('cancelled'));
  }

  async function pickItem(id: string, name?: string, previewUrl?: string) {
    if (busy || !id) return;
    busy = true;
    showError('');
    hintEl.textContent = 'Resolving File…';
    listEl.querySelectorAll('.image-modal__existing-item').forEach((el: any) => {
      el.disabled = true;
      el.classList.toggle('image-modal__existing-item--selected', el.dataset.id === id);
    });
    try {
      const result = await resolveExistingImage(id);
      const url = result?.file?.url;
      if (!url) throw new Error('Could not resolve Salesforce File URL');
      const resolve = resolvePromise;
      close();
      resolvePromise = null;
      rejectPromise = null;
      resolve?.({
        url,
        name: result.file?.name || name || id,
        previewUrl: previewUrl || url,
      });
    } catch (err: any) {
      busy = false;
      listEl.querySelectorAll('.image-modal__existing-item').forEach((el: any) => {
        el.disabled = false;
      });
      hintEl.textContent = 'Select a File linked to this record.';
      showError(err?.message ?? 'Could not use selected File');
    }
  }

  async function loadList() {
    listEl.innerHTML = '';
    showError('');
    hintEl.textContent = 'Loading…';
    try {
      const items = await listExistingImages();
      if (!items.length) {
        hintEl.textContent = 'No image Files on this record.';
        return;
      }
      hintEl.textContent = 'Select a File linked to this record.';
      for (const item of items) {
        const id = String(item?.id ?? '').trim();
        if (!id) continue;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'image-modal__existing-item';
        btn.dataset.id = id;
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', 'false');

        const thumb = document.createElement('span');
        thumb.className = 'image-modal__existing-thumb';
        if (item.url) {
          const img = document.createElement('img');
          img.alt = '';
          img.src = item.url;
          img.loading = 'lazy';
          img.addEventListener('error', () => {
            img.remove();
            thumb.textContent = (item.extension || 'IMG').toUpperCase();
          });
          thumb.appendChild(img);
        } else {
          thumb.textContent = (item.extension || 'IMG').toUpperCase();
        }

        const label = document.createElement('span');
        label.className = 'image-modal__existing-label';
        label.textContent = item.name || id;

        btn.appendChild(thumb);
        btn.appendChild(label);
        btn.addEventListener('click', () => pickItem(id, item.name, item.url));
        listEl.appendChild(btn);
      }
    } catch (err: any) {
      hintEl.textContent = '';
      showError(err?.message ?? 'Could not load Salesforce Files');
    }
  }

  function open() {
    return new Promise((resolve: any, reject: any) => {
      resolvePromise = resolve;
      rejectPromise = reject;
      mountFieldModalOverlay(overlay, parent);
      overlay.hidden = false;
      loadList();
    });
  }

  btnClose.addEventListener('click', () => cancel());
  overlay.addEventListener('click', (e: any) => {
    if (e.target === overlay) cancel();
  });
  wireModalEscape(overlay, () => cancel());

  return { open };
}
