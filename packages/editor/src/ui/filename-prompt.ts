import { wireModalEscape } from './wire-modal-escape.js';

function ensureExtension(name: any,extension: any) {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  const lower = name.toLowerCase();
  if (lower.endsWith(ext.toLowerCase())) return name;
  return `${name}${ext}`;
}

function createFilenamePromptModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="modal modal--filename" role="dialog" aria-modal="true">
      <div class="modal__header"></div>
      <div class="modal__body">
        <input type="text" class="modal__input filename-prompt__input" />
      </div>
      <div class="modal__footer">
        <button type="button" class="btn" data-action="cancel">Cancel</button>
        <button type="button" class="btn btn-primary" data-action="ok">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const header = overlay.querySelector('.modal__header');
  const input = overlay.querySelector('.filename-prompt__input');
  const btnOk = overlay.querySelector('[data-action="ok"]');
  const btnCancel = overlay.querySelector('[data-action="cancel"]');

  let resolvePromise: any = null;
  let requiredExtension = '';

  function close() {
    overlay.hidden = true;
    input.value = '';
    resolvePromise = null;
  }

  function open({ title, defaultName = '', extension = '' }: any) {
    return new Promise((resolve: any) => {
      resolvePromise = resolve;
      requiredExtension = extension;
      header.textContent = title;
      input.value = defaultName;
      overlay.hidden = false;
      input.focus();
      input.select();
    });
  }

  btnOk.addEventListener('click', () => {
    const trimmed = input.value.trim();
    if (!trimmed) return;
    const filename = requiredExtension ? ensureExtension(trimmed, requiredExtension) : trimmed;
    const resolve = resolvePromise;
    close();
    resolve?.(filename);
  });

  btnCancel.addEventListener('click', () => {
    const resolve = resolvePromise;
    close();
    resolve?.(null);
  });

  overlay.addEventListener('click', (e: any) => {
    if (e.target === overlay) btnCancel.click();
  });

  input.addEventListener('keydown', (e: any) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnOk.click();
    }
  });

  wireModalEscape(overlay, () => btnCancel.click());

  return { open };
}

let modalInstance: any = null;

/**
 * @param {{ title: string; defaultName?: string; extension?: string }} options
 * @returns {Promise<string | null>}
 */
export function promptFilename(options: any) {
  if (!modalInstance) modalInstance = createFilenamePromptModal();
  return modalInstance.open(options);
}
