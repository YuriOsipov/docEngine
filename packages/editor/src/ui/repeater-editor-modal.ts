import { wireModalEscape } from './wire-modal-escape.js';
import { FIELD_PICKER_POSITION_COOKIE, wireModalMove } from './wire-modal-move.js';

/**
 * Modal hosting a nested document editor instance.
 * Uses dynamic import to avoid circular dependency with create-editor.js.
 * @param {{ getEditorOptions?: () => import('../types.d.ts').CreateEditorOptions }} [options]
 */
export function createRepeaterEditorModal({ getEditorOptions }: any = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay modal-overlay--repeater-editor';
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="modal modal--wide modal--repeater-editor" role="dialog" aria-modal="true">
      <div class="modal__header repeater-editor-modal__header"></div>
      <div class="modal__body repeater-editor-modal__body">
        <div class="repeater-editor-modal__mount"></div>
      </div>
      <div class="modal__footer">
        <button type="button" class="btn btn-primary" data-action="ok">Save</button>
        <button type="button" class="btn" data-action="cancel">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const modalEl = overlay.querySelector('.modal') as HTMLElement | null;
  if (modalEl) {
    wireModalMove(modalEl, {
      cookieKey: FIELD_PICKER_POSITION_COOKIE,
      handle: overlay.querySelector('.repeater-editor-modal__header') as HTMLElement | null,
    });
  }

  const header = overlay.querySelector('.repeater-editor-modal__header');
  const mount = overlay.querySelector('.repeater-editor-modal__mount');
  const btnOk = overlay.querySelector('[data-action="ok"]');
  const btnCancel = overlay.querySelector('[data-action="cancel"]');

  /** @type {import('../types.d.ts').DocEditorInstance | null} */
  let nestedEditor: any = null;
  let resolvePromise: any = null;
  let rejectPromise: any = null;

  async function destroyNested() {
    if (nestedEditor) {
      nestedEditor.destroy();
      nestedEditor = null;
    }
    if (mount) mount.innerHTML = '';
  }

  async function close() {
    overlay.hidden = true;
    await destroyNested();
    resolvePromise = null;
    rejectPromise = null;
  }

  /**
   * @param {{ title: string, data: import('../types.d.ts').EditorDocument, designMode?: boolean }} params
   * @returns {Promise<import('../types.d.ts').EditorDocument>}
   */
  async function open({ title, data, designMode = false }: any) {
    await destroyNested();

    return new Promise((resolve: any,reject: any) => {
      resolvePromise = resolve;
      rejectPromise = reject;
      header.textContent = title;
      overlay.hidden = false;

      const holder = document.createElement('div');
      holder.className = 'repeater-editor-modal__holder';
      mount.appendChild(holder);

      const parentOptions = getEditorOptions?.() ?? {};

      import('../create-editor.js')
        .then(({ createEditor }: any) => {
          nestedEditor = createEditor({
            holder,
            data,
            defaultDocument: data,
            designMode: !!designMode,
            catalogs: parentOptions.catalogs,
            resolveListItems: parentOptions.resolveListItems,
            fieldValueStyle: parentOptions.fieldValueStyle,
            imageUpload: parentOptions.imageUpload,
            pickers: parentOptions.pickers,
            tools: ['documentSection'],
            ui: {
              embedded: true,
              palette: !!designMode,
              richTextToolbar: !!designMode,
              documentActions: false,
              designLayout: designMode ? 'panels' : 'chrome',
              stickyChrome: false,
            },
          });
        })
        .catch((err: any) => {
          reject(err);
          void close();
        });
    });
  }

  btnOk.addEventListener('click', async () => {
    if (!nestedEditor || !resolvePromise) return;
    try {
      await nestedEditor.ready;
      const doc = await nestedEditor.getDocument();
      const resolve = resolvePromise;
      await close();
      resolve(doc);
    } catch (err: any) {
      rejectPromise?.(err);
      await close();
    }
  });

  btnCancel.addEventListener('click', () => {
    rejectPromise?.(new Error('cancelled'));
    void close();
  });

  overlay.addEventListener('click', (e: any) => {
    if (e.target === overlay) btnCancel.click();
  });

  wireModalEscape(overlay, () => btnCancel.click());

  return { open, close };
}
