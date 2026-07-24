import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import prepareShare from '@salesforce/apex/DocEngineInstanceController.prepareShare';
import sendShareEmail from '@salesforce/apex/DocEngineInstanceController.sendShareEmail';
import {
  blobToBase64,
  canNativeShareArtifact,
  tryNativeShareArtifact
} from 'c/docEngineLib';

export default class DocEngineShareDialog extends LightningElement {
  open = false;
  busy = false;
  statusMessage = '';
  emailTo = '';
  emailSubject = '';
  emailBody = 'Please find the attached document.';
  createTask = true;
  canNativeShare = false;

  _artifact = null;
  _prepared = null;
  _ensureSaved = null;
  _docInstanceId = null;

  get filenameLabel() {
    const name = (this._artifact && this._artifact.filename) || 'document';
    const format = (this._artifact && this._artifact.format) || '';
    return format ? `${name} (${String(format).toUpperCase()})` : name;
  }

  /**
   * Open the share panel for a preview artifact.
   * @param {{ blob: Blob, filename: string, mimeType: string, format: string }} artifact
   * @param {{ ensureSaved: () => Promise<string> }} options ensureSaved must return DocEngine_Document__c Id
   */
  @api
  show(artifact, options = {}) {
    this._artifact = artifact || null;
    this._prepared = null;
    this._ensureSaved = options && typeof options.ensureSaved === 'function' ? options.ensureSaved : null;
    this.statusMessage = '';
    this.emailSubject = (artifact && artifact.filename) || 'Document';
    this.emailBody = 'Please find the attached document.';
    this.createTask = true;
    this._docInstanceId = null;
    this.canNativeShare = canNativeShareArtifact(artifact);
    this.open = !!artifact;
  }

  @api
  hide() {
    this.open = false;
    this.busy = false;
    this._artifact = null;
    this._prepared = null;
    this._ensureSaved = null;
    this._docInstanceId = null;
    this.statusMessage = '';
  }

  handleBackdropClick() {
    if (!this.busy) this.hide();
  }

  handlePanelClick(event) {
    event.stopPropagation();
  }

  handleClose() {
    this.hide();
  }

  handleEmailToChange(event) {
    this.emailTo = event.detail.value;
  }

  handleEmailSubjectChange(event) {
    this.emailSubject = event.detail.value;
  }

  handleEmailBodyChange(event) {
    this.emailBody = event.detail.value;
  }

  handleCreateTaskChange(event) {
    this.createTask = event.detail.checked;
  }

  async handleNativeShare() {
    if (!this._artifact) return;
    this.busy = true;
    this.statusMessage = 'Opening share sheet…';
    try {
      const result = await tryNativeShareArtifact(this._artifact);
      if (result === 'shared') {
        this._toast('Shared', 'Document sent via the device share sheet.', 'success');
        this.hide();
        return;
      }
      if (result === 'cancelled') {
        this.statusMessage = '';
        return;
      }
      this.statusMessage = 'Device share is not available here — use Copy link or Email.';
    } catch (err) {
      this._showError('Share failed', err);
    } finally {
      this.busy = false;
    }
  }

  async handleCopyLink() {
    this.busy = true;
    this.statusMessage = 'Preparing link…';
    try {
      const prepared = await this._ensurePrepared();
      if (prepared.publicUrl) {
        await this._copyText(prepared.publicUrl);
        this._toast(
          'Link copied',
          'Public link copied — paste into email, Slack, or Teams.',
          'success'
        );
        this.statusMessage = 'Link copied to clipboard.';
      } else {
        this._toast(
          'Saved to Files',
          'File attached to the record. Content Delivery links are unavailable in this org — attach from Files in email or Slack.',
          'success'
        );
        this.statusMessage = 'File saved to Files (no public link).';
      }
    } catch (err) {
      this._showError('Copy link failed', err);
    } finally {
      this.busy = false;
    }
  }

  async handleSendEmail() {
    this.busy = true;
    this.statusMessage = 'Sending email…';
    try {
      const prepared = await this._ensurePrepared();
      await sendShareEmail({
        contentVersionId: prepared.contentVersionId,
        toAddresses: this.emailTo,
        subject: this.emailSubject,
        body: this.emailBody,
        createTask: this.createTask,
        docInstanceId: this._docInstanceId
      });
      this._toast(
        'Email sent',
        this.createTask
          ? 'Document emailed with attachment. Task created on the record.'
          : 'Document emailed with attachment.',
        'success'
      );
      this.hide();
    } catch (err) {
      this._showError('Email failed', err);
    } finally {
      this.busy = false;
    }
  }

  async _ensurePrepared() {
    if (this._prepared) return this._prepared;
    if (!this._artifact) {
      throw new Error('No document to share.');
    }
    if (typeof this._ensureSaved !== 'function') {
      throw new Error('Document must be saved before sharing.');
    }
    const docInstanceId = await this._ensureSaved();
    if (!docInstanceId) {
      throw new Error('Save the document before sharing.');
    }
    this._docInstanceId = docInstanceId;
    const base64Data = await blobToBase64(this._artifact.blob);
    this._prepared = await prepareShare({
      docInstanceId,
      base64Data,
      filename: this._artifact.filename,
      format: this._artifact.format
    });
    return this._prepared;
  }

  async _copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }

  _toast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }

  _showError(title, err) {
    const message =
      (err && err.body && err.body.message) || (err && err.message) || String(err);
    this.statusMessage = message;
    this._toast(title, message, 'error');
  }
}
