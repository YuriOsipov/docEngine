import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  findPickerRowIndex,
  isTreePickerNavigationKey,
  navigatePickerRowIndex,
  shouldIgnorePickerNavigation,
} from './modal-picker-keyboard.js';

describe('modal-picker-keyboard', () => {
  it('navigates row indexes up and down', () => {
    const rows = [0, 1, 2];

    assert.equal(navigatePickerRowIndex(rows, -1, 'down'), 0);
    assert.equal(navigatePickerRowIndex(rows, 0, 'down'), 1);
    assert.equal(navigatePickerRowIndex(rows, 2, 'down'), 2);
    assert.equal(navigatePickerRowIndex(rows, -1, 'up'), 2);
    assert.equal(navigatePickerRowIndex(rows, 1, 'up'), 0);
  });

  it('ignores navigation from textarea and footer controls', () => {
    const { document } = parseHTML(`
      <div>
        <textarea class="modal__custom-entries-input"></textarea>
        <div class="modal__footer"><button type="button"></button></div>
        <input class="modal__search" />
      </div>
    `);
    globalThis.Element = document.defaultView.Element;

    assert.equal(shouldIgnorePickerNavigation(document.querySelector('.modal__custom-entries-input')), true);
    assert.equal(shouldIgnorePickerNavigation(document.querySelector('.modal__footer button')), true);
    assert.equal(shouldIgnorePickerNavigation(document.querySelector('.modal__search')), false);
  });

  it('finds row index and detects tree navigation keys', () => {
    const { document } = parseHTML('<div><span class="a"></span><span class="b"></span></div>');
    const rows = [...document.querySelectorAll('span')];
    assert.equal(findPickerRowIndex(rows, rows[1]), 1);
    assert.equal(isTreePickerNavigationKey('ArrowRight'), true);
    assert.equal(isTreePickerNavigationKey('Enter'), false);
  });
});
