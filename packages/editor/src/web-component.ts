import { createEditor } from './create-editor.js';

/**
 * Registers the <doc-editor> custom element.
 * @param {string} [tagName='doc-editor']
 */
export function defineDocEditorElement(tagName: any = 'doc-editor') {
  if (customElements.get(tagName)) return;

  class DocEditorElement extends HTMLElement {
  [key: string]: any;
    #editor = null;

    connectedCallback() {
      if (this.#editor) return;

      const dataAttr = this.getAttribute('data-document');
      let data: any;
      if (dataAttr) {
        try {
          data = JSON.parse(dataAttr);
        } catch {
          console.warn('[doc-editor] Invalid data-document JSON');
        }
      }

      this.#editor = createEditor({
        holder: this,
        data,
        designMode: this.hasAttribute('design-mode'),
        catalogs: this._catalogs,
        imageUpload: this._imageUpload,
        resolveListItems: this._resolveListItems,
        fieldValueStyle: this._fieldValueStyle,
        onChange: (doc: any) => {
          this.dispatchEvent(new CustomEvent('change', { detail: doc, bubbles: true }));
        },
      });
    }

    disconnectedCallback() {
      this.#editor?.destroy();
      this.#editor = null;
    }

    get editor() {
      return this.#editor;
    }

    set catalogs(value: any) {
      this._catalogs = value;
    }

    set imageUpload(value: any) {
      this._imageUpload = value;
    }

    set resolveListItems(value: any) {
      this._resolveListItems = value;
    }

    set fieldValueStyle(value: any) {
      this._fieldValueStyle = value;
    }
  }

  customElements.define(tagName, DocEditorElement);
}
