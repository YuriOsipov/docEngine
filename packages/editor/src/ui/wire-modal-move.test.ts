import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { parseHTML } from 'linkedom';
import {
  FIELD_PICKER_POSITION_COOKIE,
  readModalPositionCookie,
  writeModalPositionCookie,
  wireModalMove,
  applyModalPosition,
} from './wire-modal-move.js';

describe('wire-modal-move', () => {
  beforeEach(() => {
    const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
    globalThis.document = document;
    globalThis.window = {
      innerWidth: 1200,
      innerHeight: 800,
      document,
    } as any;
    document.cookie = '';
  });

  it('readModalPositionCookie returns null when cookie is missing', () => {
    assert.equal(readModalPositionCookie('field-picker'), null);
  });

  it('writeModalPositionCookie and readModalPositionCookie round-trip coordinates', () => {
    writeModalPositionCookie('field-picker', 120, 80);
    assert.deepEqual(readModalPositionCookie('field-picker'), { left: 120, top: 80 });
  });

  it('wireModalMove restores saved position on the modal element', () => {
    writeModalPositionCookie(FIELD_PICKER_POSITION_COOKIE, 140, 90);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const header = document.createElement('div');
    header.className = 'modal__header';
    header.textContent = 'Complaints';
    modal.appendChild(header);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    wireModalMove(modal, { cookieKey: FIELD_PICKER_POSITION_COOKIE });

    assert.equal(modal.style.left, '140px');
    assert.equal(modal.style.top, '90px');
    assert.ok(modal.classList.contains('modal--moved'));
    assert.ok(modal.classList.contains('modal--movable'));
  });

  it('applyModalPosition pins the dialog with absolute coordinates', () => {
    const modal = document.createElement('div');
    applyModalPosition(modal, 48, 64);
    assert.equal(modal.style.position, 'absolute');
    assert.equal(modal.style.left, '48px');
    assert.equal(modal.style.top, '64px');
  });
});
