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
    const { document, window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
    globalThis.document = document;
    globalThis.window = Object.assign(window, {
      innerWidth: 1200,
      innerHeight: 800,
    }) as any;
    globalThis.Event = window.Event;
    globalThis.Element = window.Element;
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

  it('moves the dialog from pointerdown so touch devices can drag the header', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    Object.defineProperty(overlay, 'clientWidth', { value: 1200 });
    Object.defineProperty(overlay, 'clientHeight', { value: 800 });
    overlay.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 }) as DOMRect;

    const modal = document.createElement('div');
    modal.className = 'modal';
    Object.defineProperty(modal, 'offsetWidth', { value: 400 });
    Object.defineProperty(modal, 'offsetHeight', { value: 240 });
    modal.getBoundingClientRect = () =>
      ({ left: 100, top: 80, width: 400, height: 240, right: 500, bottom: 320 }) as DOMRect;

    const header = document.createElement('div');
    header.className = 'modal__header';
    header.textContent = 'Complaints';
    modal.appendChild(header);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    wireModalMove(modal, { cookieKey: FIELD_PICKER_POSITION_COOKIE });

    function fire(target: EventTarget, type: string, props: Record<string, unknown>) {
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      for (const [key, value] of Object.entries(props)) {
        Object.defineProperty(event, key, { value });
      }
      target.dispatchEvent(event);
    }

    fire(header, 'pointerdown', { button: 0, isPrimary: true, pointerId: 1, clientX: 120, clientY: 90 });
    assert.ok(modal.classList.contains('modal--dragging'));

    fire(document, 'pointermove', { pointerId: 1, clientX: 180, clientY: 150 });
    assert.equal(modal.style.left, '160px');
    assert.equal(modal.style.top, '140px');

    fire(document, 'pointerup', { pointerId: 1, clientX: 180, clientY: 150 });
    assert.equal(modal.classList.contains('modal--dragging'), false);
    assert.deepEqual(readModalPositionCookie(FIELD_PICKER_POSITION_COOKIE), { left: 160, top: 140 });
  });
});
