export const PICKER_ROW_ACTIVE_CLASS = 'modal-picker-row--active';

function isInsideHiddenAncestor(row: Element, container: Element) {
  for (let el = row.parentElement; el && el !== container; el = el.parentElement) {
    if (el.hasAttribute('hidden')) return true;
  }
  return false;
}

export function getPickerRows(container: Element, rowSelector: string) {
  return [...container.querySelectorAll(rowSelector)].filter(
    (row) => !isInsideHiddenAncestor(row, container),
  );
}

export function clearPickerRowActive(container: Element) {
  container.querySelectorAll(`.${PICKER_ROW_ACTIVE_CLASS}`).forEach((row) => {
    row.classList.remove(PICKER_ROW_ACTIVE_CLASS);
  });
}

export function setPickerRowActive(
  rows: Element[],
  index: number,
  scrollParent: Element | null = null,
) {
  rows.forEach((row, rowIndex) => {
    row.classList.toggle(PICKER_ROW_ACTIVE_CLASS, rowIndex === index);
  });

  const row = rows[index];
  if (!(row instanceof HTMLElement)) return;
  if (!(scrollParent instanceof HTMLElement)) return;

  // Only adjust the list/tree scroller — never scrollIntoView (that scrolls the page behind).
  const parentRect = scrollParent.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  if (rowRect.bottom > parentRect.bottom) {
    scrollParent.scrollTop += rowRect.bottom - parentRect.bottom;
  } else if (rowRect.top < parentRect.top) {
    scrollParent.scrollTop -= parentRect.top - rowRect.top;
  }
}

/** True for keys that must not reach the page/editor while a picker is open. */
export function isPickerArrowKey(key: string) {
  return key === 'ArrowDown' || key === 'ArrowUp' || key === 'ArrowLeft' || key === 'ArrowRight';
}

export function navigatePickerRowIndex(
  rows: ArrayLike<unknown>,
  currentIndex: number,
  direction: 'up' | 'down',
) {
  if (!rows.length) return -1;

  if (currentIndex < 0) {
    return direction === 'down' ? 0 : rows.length - 1;
  }

  if (direction === 'down') {
    return Math.min(currentIndex + 1, rows.length - 1);
  }

  return Math.max(currentIndex - 1, 0);
}

export function isPickerNavigationKey(key: string) {
  return key === 'ArrowDown' || key === 'ArrowUp' || key === ' ';
}

export function isTreePickerNavigationKey(key: string) {
  return isPickerNavigationKey(key) || key === 'ArrowLeft' || key === 'ArrowRight';
}

export function findPickerRowIndex(rows: Element[], row: Element | null) {
  if (!row) return -1;
  return rows.indexOf(row);
}

export function shouldIgnorePickerNavigation(target: EventTarget | null) {
  // Non-element targets (window/document) are fine — modal owns the arrows.
  if (!(target instanceof Element)) return false;
  if (target.closest('.modal__custom-entries-input')) return true;
  if (target.closest('.modal__footer')) return true;
  return false;
}
