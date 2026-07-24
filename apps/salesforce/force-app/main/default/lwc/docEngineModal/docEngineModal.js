import { api } from 'lwc';
import LightningModal from 'lightning/modal';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getTemplate from '@salesforce/apex/DocEngineTemplateController.getTemplate';
import buildPayload from '@salesforce/apex/DocEngineMergeController.buildPayload';
import saveInstance from '@salesforce/apex/DocEngineInstanceController.saveInstance';
import saveHtml from '@salesforce/apex/DocEngineInstanceController.saveHtml';
import getInstance from '@salesforce/apex/DocEngineInstanceController.getInstance';
import generateAndSavePdf from '@salesforce/apex/DocEnginePdfController.generateAndSavePdf';
import resolveListItems from '@salesforce/apex/DocEngineListController.resolveListItems';
import resolveTemplateId from '@salesforce/apex/DocEngineButtonController.resolveTemplateId';
import {
  ensureDocEngineAssets,
  createDocEditor,
  resolveCreateDocEditorOptions,
  checkPdfAvailable,
  resolvePdfProvider,
  exportHtmlForPdf,
  emptyDocument,
  parseJsonSafe,
  resolveReopenEditorData
} from 'c/docEngineLib';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toBase64Utf8(text) {
  const bytes = new TextEncoder().encode(String(text ?? ''));
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export default class DocEngineModal extends LightningModal {
  @api recordId;
  @api objectApiName;
  @api templateId;
  @api fillMode;
  @api exportMode = 'none';
  @api showPreview;
  @api hideEmpty;
  @api attachToRecord;
  /** When set, reopen an existing DocEngine_Document__c for edit. */
  @api instanceId;

  templateName = 'DocEngine';
  errorMessage = '';
  busy = false;
  showSpinner = true;
  showEditor = false;

  _editor = null;
  _editorInitialized = false;
  _pendingInit = false;
  _instanceId = null;
  _pdfAvailable = false;
  _pdfProvider = 'Salesforce';
  _resolvedTemplateId = '';
  _templateDto = null;
  _initialData = null;
  _fieldMapping = null;
  _mergePayload = null;
  _autoFinishAfterMount = false;
  _pendingValues = null;
  _bootstrapped = false;
  _recordIdFallback = '';
  _objectApiNameFallback = '';
  /** Current DocEngine_Document__c status; new docs start as Draft. */
  _documentStatus = 'Draft';
  /** True while Document preview overlay is open (Cancel closes preview only). */
  _previewOpen = false;

  get effectiveRecordId() {
    return this.recordId || this._recordIdFallback || '';
  }

  get effectiveObjectApiName() {
    return this.objectApiName || this._objectApiNameFallback || '';
  }

  /** Save Draft is for Fill mode when the document is not already Completed. */
  get showSaveDraft() {
    return this._asBool(this.fillMode, true) && this._documentStatus !== 'Completed';
  }

  connectedCallback() {
    Promise.all([checkPdfAvailable(), resolvePdfProvider()]).then(([ok, provider]) => {
      this._pdfAvailable = ok;
      this._pdfProvider = provider || 'Salesforce';
    });
    this._bootstrap();
  }

  disconnectedCallback() {
    this._destroyEditor();
  }

  renderedCallback() {
    if (!this._pendingInit || this._editorInitialized) return;
    const editorRoot = this.template.querySelector('.editor-root');
    const stickyChrome = this.template.querySelector('.sticky-chrome');
    const docActions = this.template.querySelector('.doc-actions');
    if (!editorRoot || !stickyChrome || !docActions) return;
    this._pendingInit = false;
    this._mountEditor(editorRoot, stickyChrome, docActions);
  }

  async _bootstrap() {
    if (this._bootstrapped) return;
    this._bootstrapped = true;
    this.showSpinner = true;
    this.errorMessage = '';
    try {
      await ensureDocEngineAssets(this);

      if (this.instanceId) {
        const inst = await getInstance({ instanceId: this.instanceId });
        this._instanceId = inst.id;
        this._resolvedTemplateId = inst.templateId;
        this._recordIdFallback = inst.recordId || '';
        this._objectApiNameFallback = inst.objectApiName || '';
        this._documentStatus = inst.status || 'Draft';
        const dto = await getTemplate({ templateId: this._resolvedTemplateId });
        this._templateDto = dto;
        this.templateName = (dto && dto.name) || inst.name || 'DocEngine';
        const templateJson = inst.templateJson || (dto && dto.templateJson);
        const reopen = resolveReopenEditorData(inst.documentJson, templateJson);
        this._initialData = reopen.initialData;
        this._pendingValues = reopen.pendingValues;
        const templateData = parseJsonSafe(templateJson, emptyDocument());
        this._fieldMapping =
          (templateData && templateData.fieldMapping) ||
          (reopen.initialData && reopen.initialData.fieldMapping) ||
          null;
        this.showEditor = true;
        this._pendingInit = true;
        this._autoFinishAfterMount = false;
        return;
      }

      this._resolvedTemplateId = await resolveTemplateId({ templateId: this.templateId });
      const dto = await getTemplate({ templateId: this._resolvedTemplateId });
      this._templateDto = dto;
      this.templateName = dto.name || 'DocEngine';
      this._initialData = parseJsonSafe(dto.templateJson, emptyDocument());
      this._fieldMapping =
        (this._initialData && this._initialData.fieldMapping) || null;

      try {
        this._mergePayload = await buildPayload({
          recordId: this.effectiveRecordId,
          templateId: this._resolvedTemplateId,
          templateVersionId: null
        });
      } catch (mergeErr) {
        this._mergePayload = null;
        this._showToast(
          'Merge skipped',
          (mergeErr && mergeErr.body && mergeErr.body.message) ||
            (mergeErr && mergeErr.message) ||
            'Could not build merge payload.',
          'warning'
        );
      }

      this.showEditor = true;
      this._pendingInit = true;
      this._autoFinishAfterMount = !this._asBool(this.fillMode, true);
    } catch (err) {
      this._showError('DocEngine', err);
    } finally {
      this.showSpinner = false;
    }
  }

  async _mountEditor(editorRoot, stickyChrome, docActions) {
    try {
      this._editor = createDocEditor(
        await resolveCreateDocEditorOptions({
          holder: editorRoot,
          chromeParent: stickyChrome,
          documentActionsContainer: docActions,
          designMode: false,
          data: this._initialData || emptyDocument(),
          resolveListItems: this._resolveListItems.bind(this),
          onShareDocument: (artifact) => this._openShareDialog(artifact),
          onPreviewStateChange: (open) => {
            this._previewOpen = !!open;
            // Keep ESC / header X from dismissing the editor while preview is up.
            this.disableClose = !!open;
          },
          ui: {
            showPreview: this._asBool(this.showPreview, true)
          }
        })
      );
      await this._editor.ready;

      if (this._fieldMapping && typeof this._editor.setFieldMapping === 'function') {
        this._editor.setFieldMapping(this._fieldMapping);
      }
      if (
        this._pendingValues &&
        typeof this._editor.load === 'function'
      ) {
        try {
          await this._editor.load(this._pendingValues);
        } catch (e) {
          this._showToast(
            'Values warning',
            (e && e.message) || 'Could not apply saved values.',
            'warning'
          );
        }
        this._pendingValues = null;
      }
      if (
        !this.instanceId &&
        this._fieldMapping &&
        this._mergePayload &&
        typeof this._editor.applyFieldMapping === 'function'
      ) {
        try {
          await this._editor.applyFieldMapping(this._mergePayload);
        } catch (e) {
          this._showToast('Merge warning', (e && e.message) || 'Merge failed', 'warning');
        }
      }

      this._editorInitialized = true;

      if (this._autoFinishAfterMount) {
        this._autoFinishAfterMount = false;
        await this.handleFinish();
      }
    } catch (err) {
      this._showError('Failed to start editor', err);
    }
  }

  async handleFinish() {
    if (!this._editor || !this.effectiveRecordId || !this._resolvedTemplateId) return;
    try {
      this.busy = true;
      this.showSpinner = true;

      // Do not open Document preview on Finish — save, attach, then close fill modal.
      // Success toast is returned to the opener so it lingers after the modal closes.
      this._closeNestedPreviewIfOpen();

      await this._saveInstanceOnly('Completed');

      // Completing always attaches (or revises) the PDF/HTML file on the document + source record.
      const exportMode = this._asExportMode(this.exportMode);
      const format = exportMode === 'pdf' || exportMode === 'html' ? exportMode : 'html';
      let warningToast = null;
      let successToast = {
        title: 'Saved & attached',
        message: 'Document saved. HTML attached to Notes & Attachments / Files.',
        variant: 'success'
      };

      if (format === 'pdf') {
        if (!this._pdfAvailable) {
          warningToast = {
            title: 'PDF unavailable',
            message:
              'Uncheck DocEngine Settings → Use External PDF, or install DocEngine_PDF for External. Attaching HTML instead.',
            variant: 'warning'
          };
          await this._attachHtml();
        } else {
          const html =
            this._pdfProvider === 'Salesforce'
              ? await exportHtmlForPdf(this._editor, {
                  title: (this._templateDto && this._templateDto.name) || 'document',
                  hideEmptyValues: this._asBool(this.hideEmpty, false)
                })
              : null;
          await generateAndSavePdf({ docInstanceId: this._instanceId, html });
          successToast = {
            title: 'Saved & attached',
            message: 'Document saved. PDF attached to Notes & Attachments / Files.',
            variant: 'success'
          };
        }
      } else {
        await this._attachHtml();
      }

      this.disableClose = false;
      this.close({
        status: 'finished',
        warningToast,
        toast: successToast
      });
    } catch (err) {
      this._showError('Finish failed', err);
    } finally {
      this.busy = false;
      this.showSpinner = false;
    }
  }

  async handleSaveDraft() {
    if (!this._editor || !this.effectiveRecordId || !this._resolvedTemplateId) return;
    if (this._documentStatus === 'Completed') return;
    try {
      this.busy = true;
      this.showSpinner = true;
      await this._saveInstanceOnly('Draft');
      this._showToast('Draft saved', 'Document saved as Draft.', 'success');
    } catch (err) {
      this._showError('Save Draft failed', err);
    } finally {
      this.busy = false;
      this.showSpinner = false;
    }
  }

  handleCancel(event) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    // Close Document preview first — do not dismiss the editor.
    if (this._closeNestedPreviewIfOpen()) {
      return;
    }
    this.disableClose = false;
    this.close('cancelled');
  }

  _closeNestedPreviewIfOpen() {
    let open = this._previewOpen === true;
    try {
      if (
        !open &&
        this._editor &&
        typeof this._editor.isPreviewOpen === 'function' &&
        this._editor.isPreviewOpen()
      ) {
        open = true;
      }
    } catch (e) {
      /* LWS may block some API reads — fall through to DOM check */
    }
    if (!open && this._findOpenPreviewOverlay()) {
      open = true;
    }
    if (!open) {
      return false;
    }
    try {
      if (this._editor && typeof this._editor.closePreview === 'function') {
        this._editor.closePreview();
      }
    } catch (e) {
      const overlay = this._findOpenPreviewOverlay();
      if (overlay) {
        overlay.hidden = true;
        overlay.setAttribute('data-preview-open', 'false');
      }
    }
    this._previewOpen = false;
    this.disableClose = false;
    return true;
  }

  _findOpenPreviewOverlay() {
    const match = (root) => {
      if (!root || typeof root.querySelector !== 'function') return null;
      return (
        root.querySelector('.modal-overlay--preview[data-preview-open="true"]') ||
        root.querySelector('.modal-overlay--preview:not([hidden])')
      );
    };
    let node = this.template && this.template.host;
    const seen = new Set();
    while (node && !seen.has(node)) {
      seen.add(node);
      const found = match(node);
      if (found) return found;
      const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
      if (root && root.host) {
        node = root.host;
        continue;
      }
      node = node.parentElement || node.parentNode;
    }
    try {
      return match(document);
    } catch (e) {
      return null;
    }
  }

  async _saveInstanceOnly(status = 'Completed') {
    const values =
      typeof this._editor.exportFields === 'function'
        ? await this._editor.exportFields()
        : null;
    if (!values) {
      throw new Error('exportFields is not available on the editor.');
    }
    const saved = await saveInstance({
      dto: {
        id: this._instanceId,
        name: (this._templateDto && this._templateDto.name) || 'Document',
        templateId: this._resolvedTemplateId,
        templateVersionId: (this._templateDto && this._templateDto.versionId) || null,
        recordId: this.effectiveRecordId,
        objectApiName: this.effectiveObjectApiName,
        documentJson: JSON.stringify(values),
        status,
        completedDate: null
      }
    });
    this._instanceId = saved.id;
    this._documentStatus = saved.status || status;
    return saved;
  }

  _openShareDialog(artifact) {
    const dialog = this.template.querySelector('c-doc-engine-share-dialog');
    if (!dialog || typeof dialog.show !== 'function') {
      this._showToast(
        'Share unavailable',
        'Share dialog failed to load. Redeploy docEngineShareDialog.',
        'error'
      );
      return;
    }
    dialog.show(artifact, {
      ensureSaved: async () => {
        await this._saveInstanceOnly();
        return this._instanceId;
      }
    });
  }

  async _buildHtmlDocument() {
    const title = (this._templateDto && this._templateDto.name) || 'document';
    const hideEmpty = this._asBool(this.hideEmpty, false);
    if (this._editor && typeof this._editor.exportPreviewHtml === 'function') {
      return this._editor.exportPreviewHtml({ hideEmptyValues: hideEmpty, title });
    }
    const doc = await this._editor.exportDoc();
    return (
      '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>' +
      escapeHtml(title) +
      '</title></head><body><h1>' +
      escapeHtml(title) +
      '</h1><pre>' +
      escapeHtml(JSON.stringify(doc, null, 2)) +
      '</pre></body></html>'
    );
  }

  async _attachHtml() {
    const title = (this._templateDto && this._templateDto.name) || 'document';
    const safeName = String(title).replace(/[^\w.-]+/g, '_') || 'document';
    const html = await this._buildHtmlDocument();
    await saveHtml({
      docInstanceId: this._instanceId,
      base64Data: toBase64Utf8(html),
      filename: safeName + '.html'
    });
  }

  async _resolveListItems({ fieldName, query, schema, sourceCollection: sourceFromArg }) {
    let sourceCollection =
      (sourceFromArg && String(sourceFromArg).trim()) ||
      (schema && schema.sourceCollection && String(schema.sourceCollection).trim()) ||
      '';
    if (!sourceCollection && !(fieldName || '').includes('.')) {
      sourceCollection = (this.effectiveObjectApiName || '').trim();
    }
    const rows = await resolveListItems({
      fieldName: fieldName || '',
      query: query || '',
      sourceCollection
    });
    return (rows || []).map((row) => ({
      id: row.id,
      label: row.label,
      value: row.value != null ? row.value : row.label,
      code: row.code
    }));
  }

  _destroyEditor() {
    this._previewOpen = false;
    this.disableClose = false;
    this._pendingValues = null;
    if (this._editor && typeof this._editor.destroy === 'function') {
      this._editor.destroy();
    }
    this._editor = null;
    this._editorInitialized = false;
  }

  _asBool(value, fallback = true) {
    if (value === true || value === false) return value;
    if (value == null || value === '') return fallback;
    const s = String(value).trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
    return fallback;
  }

  _asExportMode(value) {
    const s = String(value || 'none').trim().toLowerCase();
    if (s === 'pdf' || s === 'html' || s === 'none') return s;
    return 'none';
  }

  _showToast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }

  _showError(title, err) {
    const message =
      (err && err.body && err.body.message) || (err && err.message) || String(err);
    this.errorMessage = message;
    this.dispatchEvent(
      new ShowToastEvent({ title, message, variant: 'error', mode: 'sticky' })
    );
  }
}
