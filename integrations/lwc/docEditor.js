/**
 * Reference LWC controller — init snippet for document editor on a Lightning page.
 *
 * Prerequisites:
 *   - Static Resource "DocEngineCss"     → dist/editor-lwc.css  (npm run build:sf)
 *   - Static Resource "DocEngineBundle"  → dist/editor-lwc.js   (IIFE, window.DocEditor)
 *
 * Host contract: see `doc-editor-contract.d.ts` (createEditor / ready / destroy /
 * setDesignMode / exportDoc / load). Treat that API as freeze for Salesforce hosts.
 *
 * Copy into your LWC .js file and adapt record load/save to your Apex controllers.
 */

import { LightningElement, api, wire } from 'lwc';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import editorCss from '@salesforce/resourceUrl/DocEngineCss';
import editorJs from '@salesforce/resourceUrl/DocEngineBundle';
// import getDocument from '@salesforce/apex/DocEngineInstanceController.getInstance';
// import saveDocument from '@salesforce/apex/DocEngineInstanceController.saveInstance';

export default class DocEditor extends LightningElement {
  @api recordId;

  designMode = false;
  _editor = null;
  _document = null;
  _assetsLoaded = false;
  _editorInitialized = false;

  _editorRoot = null;
  _stickyChrome = null;
  _docActions = null;

  renderedCallback() {
    if (this._editorInitialized) return;

    this._editorRoot = this.template.querySelector('.editor-root');
    this._stickyChrome = this.template.querySelector('.sticky-chrome');
    this._docActions = this.template.querySelector('.doc-actions');

    if (!this._editorRoot || !this._stickyChrome || !this._docActions) return;

    this._initEditor();
  }

  async _initEditor() {
    try {
      if (!this._assetsLoaded) {
        await Promise.all([
          loadStyle(this, editorCss),
          loadScript(this, editorJs),
        ]);
        this._assetsLoaded = true;
      }

      const { createEditor } = window.DocEditor ?? {};
      if (typeof createEditor !== 'function') {
        throw new Error('DocEditor.createEditor not found on window.DocEditor');
      }

      this._editor = createEditor({
        holder: this._editorRoot,
        data: this._document ?? { time: Date.now(), fieldSchemas: {}, blocks: [] },
        catalogs: { lists: {}, trees: {} },
        ui: {
          designLayout: 'chrome',
          chromeParent: this._stickyChrome,
          documentActionsContainer: this._docActions,
          stickyChrome: false,
        },
        fieldValueStyle: {
          default: {
            fontFamily: "'Salesforce Sans', Arial, sans-serif",
            fontSize: '0.8125rem',
          },
        },
        resolveListItems: this._resolveListItems.bind(this),
        onChange: (doc) => {
          this._document = doc;
        },
      });

      await this._editor.ready;
      this._editorInitialized = true;
    } catch (err) {
      this._showError('Failed to load editor', err);
    }
  }

  disconnectedCallback() {
    this._editor?.destroy();
    this._editor = null;
    this._editorInitialized = false;
  }

  async handleDesignToggle(event) {
    this.designMode = event.target.checked;
    if (this._editor) {
      await this._editor.setDesignMode(this.designMode);
    }
  }

  async handleSave() {
    if (!this._editor) return;
    try {
      const doc = await this._editor.exportDoc();
      // await saveDocument({ recordId: this.recordId, json: JSON.stringify(doc) });
      this._showToast('Saved', 'Document saved.', 'success');
    } catch (err) {
      this._showError('Save failed', err);
    }
  }

  async handleExport() {
    if (!this._editor) return;
    const doc = await this._editor.exportDoc();
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !this._editor) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await this._editor.load(data);
        this._showToast('Imported', 'Document loaded.', 'success');
      } catch (err) {
        this._showError('Import failed', err);
      }
    };
    input.click();
  }

  /**
   * Remote list fields — wire to Apex.
   * @param {{ fieldName: string, query: string, signal: AbortSignal }} opts
   */
  async _resolveListItems({ fieldName, query, signal }) {
    // return getListItems({ fieldName, query });
    void fieldName;
    void query;
    void signal;
    return [];
  }

  _showToast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }

  _showError(title, err) {
    const message = err?.message ?? String(err);
    this.dispatchEvent(new ShowToastEvent({ title, message, variant: 'error' }));
  }
}
