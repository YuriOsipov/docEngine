import { wireModalEscape } from './wire-modal-escape.js';
import { wireModalResize } from './wire-modal-resize.js';
import {
  FIELD_PICKER_FOOTER_HINT_HTML,
  FIELD_MODAL_OVERLAY_CLASS,
  mountFieldModalOverlay,
  wireModalConfirmShortcut,
} from './wire-modal-palette.js';
import {
  renderSelectionPills,
} from './modal-picker-pills.js';
import {
  clearPickerRowActive,
  findPickerRowIndex,
  getPickerRows,
  isPickerArrowKey,
  isPickerNavigationKey,
  navigatePickerRowIndex,
  setPickerRowActive,
  shouldIgnorePickerNavigation,
} from './modal-picker-keyboard.js';
import {
  formatManualEditText,
  parseCustomEntriesText,
  parseManualEditText,
  splitManualEditLines,
  syncManualEditTextareaOrder,
} from '../fields/manual-field-values.js';
import { applyFieldFormTextStyle } from '../core/page-setup-styles.js';

const SEARCH_DEBOUNCE_MS = 300;

function escapeHtml(text: any) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightText(text: any,query: any) {
  const raw = String(text ?? '');
  const q = query.trim();
  if (!q) return escapeHtml(raw);

  const lower = raw.toLowerCase();
  const lowerQ = q.toLowerCase();
  let result = '';
  let start = 0;
  let index = lower.indexOf(lowerQ, start);

  while (index !== -1) {
    result += escapeHtml(raw.slice(start, index));
    result += `<mark class="list-item__highlight">${escapeHtml(raw.slice(index, index + q.length))}</mark>`;
    start = index + q.length;
    index = lower.indexOf(lowerQ, start);
  }

  result += escapeHtml(raw.slice(start));
  return result;
}

export function createListModal({ parent = null }: { parent?: HTMLElement | null } = {}) {
  const overlay = document.createElement('div');
  overlay.className = FIELD_MODAL_OVERLAY_CLASS;
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="modal modal--list" role="dialog" aria-modal="true">
      <div class="modal__header"></div>
      <div class="modal__body">
        <div class="list-root"></div>
        <label class="modal__custom-entries" hidden>
          <span class="modal__custom-entries-label">Custom entries</span>
          <textarea class="modal__custom-entries-input" rows="2" placeholder="Semicolon-separated labels"></textarea>
        </label>
        <div class="modal__selection-panel">
          <input type="text" class="modal__search" placeholder="Search..." autocomplete="off" />
          <div class="modal__selection-pills" hidden></div>
          <p class="modal__status modal__status--empty"></p>
        </div>
      </div>
      <div class="modal__footer">
        <button type="button" class="btn" data-action="clear">Clear</button>
        <button type="button" class="btn btn-primary" data-action="ok">OK</button>
        ${FIELD_PICKER_FOOTER_HINT_HTML}
        <button type="button" class="btn" data-action="close">Close</button>
      </div>
    </div>
  `;

  mountFieldModalOverlay(overlay, parent);

  const modalEl = overlay.querySelector('.modal');
  wireModalResize(modalEl, { cookieKey: 'list-picker' });

  const header = overlay.querySelector('.modal__header');
  const searchInput = overlay.querySelector('.modal__search');
  const statusEl = overlay.querySelector('.modal__status');
  const pillsRoot = overlay.querySelector('.modal__selection-pills');
  const listRoot = overlay.querySelector('.list-root');
  const customEntriesBlock = overlay.querySelector('.modal__custom-entries');
  const customEntriesInput = overlay.querySelector('.modal__custom-entries-input');
  const btnClear = overlay.querySelector('[data-action="clear"]');
  const btnOk = overlay.querySelector('[data-action="ok"]');
  const btnClose = overlay.querySelector('[data-action="close"]');

  let resolvePromise: any = null;
  let rejectPromise: any = null;
  let currentItems: any[] = [];
  let selectedLabels = new Set<string>();
  let showCode = false;
  let multi = true;
  let remoteSearchFn: any = null;
  let searchGeneration = 0;
  let searchDebounceTimer: any = null;
  let allowManualEdit = false;
  let catalogLabelSet = new Set<string>();
  let freeTextLines: any[] = [];
  let orderedLines: string[] = [];
  let activeRowIndex = -1;
  let previousBodyOverflow = '';

  const listRowSelector = '.list-item';

  function isManualEditMode() {
    return allowManualEdit;
  }

  function rebuildCatalogLabelSet() {
    catalogLabelSet = new Set((currentItems ?? []).map((item) => formatLabel(item)));
  }

  function removeSelectionLine(line: string) {
    selectedLabels.delete(line);
    orderedLines = orderedLines.filter((entry) => entry !== line);
    freeTextLines = freeTextLines.filter((entry) => entry !== line);
    if (isManualEditMode()) {
      rebuildManualEditTextarea();
    } else {
      renderSelectionSummary();
    }
    if (remoteSearchFn && currentItems.length) {
      renderItems(currentItems);
    } else {
      renderList(searchInput.value);
    }
  }

  function rebuildManualEditTextarea() {
    if (!isManualEditMode() || !customEntriesInput) return;
    if (multi) {
      const currentLines = parseCustomEntriesText(customEntriesInput.value);
      orderedLines = syncManualEditTextareaOrder(currentLines, [...selectedLabels], catalogLabelSet);
      freeTextLines = orderedLines.filter((line) => !catalogLabelSet.has(line));
      customEntriesInput.value = formatManualEditText(orderedLines, 'list');
    } else {
      const catalogLabel = [...selectedLabels][0] ?? '';
      const line = catalogLabel || freeTextLines[0] || '';
      orderedLines = line ? [line] : [];
      customEntriesInput.value = catalogLabel || formatManualEditText(freeTextLines, 'choice');
    }

    renderSelectionSummary();
  }

  function refreshManualEditFromInput() {
    if (!isManualEditMode()) return;
    if (multi) {
      orderedLines = parseCustomEntriesText(customEntriesInput?.value ?? '');
      selectedLabels = new Set(orderedLines.filter((entry) => catalogLabelSet.has(entry)));
      freeTextLines = orderedLines.filter((entry) => !catalogLabelSet.has(entry));
    } else {
      const text = String(customEntriesInput?.value ?? '').trim();
      orderedLines = text ? [text] : [];
      if (catalogLabelSet.has(text)) {
        selectedLabels = new Set([text]);
        freeTextLines = [];
      } else {
        selectedLabels = new Set();
        freeTextLines = text ? [text] : [];
      }
    }
    if (remoteSearchFn && currentItems.length) {
      renderItems(currentItems);
    } else {
      renderList(searchInput.value);
    }
  }

  function renderSelectionSummary() {
    const lines = isManualEditMode() ? [] : [...selectedLabels];
    renderSelectionPills(pillsRoot, lines, removeSelectionLine);
  }

  function updateSelectionFromInput(input: any) {
    const row = input.closest('.list-item');
    if (!row || !listRoot.contains(row)) return;

    const fullLabel = row.dataset.label ?? '';
    if (!fullLabel) return;

    if (multi) {
      if (input.checked) {
        selectedLabels.add(fullLabel);
      } else {
        selectedLabels.delete(fullLabel);
      }
      if (isManualEditMode()) {
        rebuildManualEditTextarea();
      } else {
        renderSelectionSummary();
      }
      return;
    }

    selectedLabels.clear();
    if (input.checked) {
      selectedLabels.add(fullLabel);
      if (isManualEditMode()) {
        rebuildManualEditTextarea();
      } else {
        renderSelectionSummary();
      }
      confirmSelection();
    }
  }

  listRoot.addEventListener('change', (e) => {
    const input = e.target;
    if (!input || input.tagName !== 'INPUT') return;
    updateSelectionFromInput(input);
  });

  listRoot.addEventListener('click', (e) => {
    const row = (e.target as Element | null)?.closest('.list-item');
    if (!row || !listRoot.contains(row)) return;
    setActiveListRowFromElement(row);
    // Return focus to search so ↑↓ keep driving the highlight, not radio groups.
    searchInput.focus({ preventScroll: true });
  });

  if (customEntriesInput) {
    customEntriesInput.addEventListener('input', () => {
      refreshManualEditFromInput();
    });
  }

  function close() {
    overlay.hidden = true;
    document.body.style.overflow = previousBodyOverflow;
    listRoot.innerHTML = '';
    searchInput.value = '';
    selectedLabels = new Set();
    remoteSearchFn = null;
    searchGeneration += 1;
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
    allowManualEdit = false;
    catalogLabelSet = new Set<string>();
    freeTextLines = [];
    orderedLines = [];
    if (customEntriesInput) customEntriesInput.value = '';
    if (customEntriesBlock) customEntriesBlock.hidden = true;
    renderSelectionPills(pillsRoot, [], () => {});
    clearPickerRowActive(listRoot);
    activeRowIndex = -1;
    setStatus('');
    setLoading(false);
  }

  function getVisibleListRows() {
    return getPickerRows(listRoot, listRowSelector);
  }

  function setActiveListRowFromElement(row: Element | null) {
    const rows = getVisibleListRows();
    const index = findPickerRowIndex(rows, row);
    if (index < 0) return;
    activeRowIndex = index;
    setPickerRowActive(rows, activeRowIndex, listRoot);
  }

  function applyActiveListRowHighlight() {
    const rows = getVisibleListRows();
    if (activeRowIndex < 0 || activeRowIndex >= rows.length) {
      clearPickerRowActive(listRoot);
      activeRowIndex = -1;
      return;
    }
    setPickerRowActive(rows, activeRowIndex, listRoot);
  }

  function highlightFirstSearchMatch() {
    const q = searchInput.value.trim();
    if (!q) {
      activeRowIndex = -1;
      applyActiveListRowHighlight();
      return;
    }
    const rows = getVisibleListRows();
    activeRowIndex = rows.length ? 0 : -1;
    applyActiveListRowHighlight();
  }

  function activateHighlightedListRow() {
    const rows = getVisibleListRows();
    const row = rows[activeRowIndex];
    if (!row) return;

    const input = row.querySelector('input') as HTMLInputElement | null;
    if (!input) return;

    if (multi) {
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function handleListPickerNavigation(event: KeyboardEvent) {
    if (overlay.hidden || shouldIgnorePickerNavigation(event.target)) return false;
    if (listRoot.classList.contains('list-root--loading')) return false;

    const rows = getVisibleListRows();
    if (!rows.length) return false;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      activeRowIndex = navigatePickerRowIndex(
        rows,
        activeRowIndex,
        event.key === 'ArrowDown' ? 'down' : 'up',
      );
      setPickerRowActive(rows, activeRowIndex, listRoot);
      searchInput.focus({ preventScroll: true });
      return true;
    }

    if (event.key === ' ' && activeRowIndex >= 0) {
      activateHighlightedListRow();
      searchInput.focus({ preventScroll: true });
      return true;
    }

    return false;
  }

  function onWindowPickerKeydown(e: KeyboardEvent) {
    if (overlay.hidden) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (shouldIgnorePickerNavigation(e.target)) return;

    // Consume arrow keys before Editor.js / page scroll handlers (window capture runs first).
    if (isPickerArrowKey(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!overlay.contains(document.activeElement)) {
        searchInput.focus({ preventScroll: true });
      }
      handleListPickerNavigation(e);
      return;
    }

    if (e.key === ' ') {
      if (handleListPickerNavigation(e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
  }

  function confirmSelection() {
    const resolve = resolvePromise;
    let result: any;

    if (allowManualEdit) {
      const schemaType = multi ? 'list' : 'choice';
      const parsed = parseManualEditText(customEntriesInput?.value ?? '', schemaType);
      result = multi ? parsed : (parsed ? [parsed] : []);
    } else if (multi) {
      result = [...selectedLabels];
    } else {
      result = selectedLabels.size > 0 ? [[...selectedLabels][0]] : [];
    }

    close();
    resolve?.(result);
    resolvePromise = null;
    rejectPromise = null;
  }

  function formatLabel(item: any) {
    if (showCode && item.code) {
      return `${item.code} — ${item.label}`;
    }
    return item.label;
  }

  function setStatus(message: any,isError: any = false) {
    if (!statusEl) return;
    statusEl.textContent = message || '\u00a0';
    statusEl.classList.toggle('modal__status--error', isError);
    statusEl.classList.toggle('modal__status--empty', !message);
  }

  function setLoading(loading: any) {
    listRoot.classList.toggle('list-root--loading', loading);
  }

  function captureSearchCaret() {
    return {
      start: searchInput.selectionStart,
      end: searchInput.selectionEnd,
      hadFocus: document.activeElement === searchInput,
    };
  }

  function restoreSearchCaret(snapshot: any) {
    if (!snapshot?.hadFocus || overlay.hidden) return;
    if (document.activeElement === searchInput) return;

    searchInput.focus({ preventScroll: true });
    const len = searchInput.value.length;
    const start = Math.min(snapshot.start ?? len, len);
    const end = Math.min(snapshot.end ?? len, len);
    searchInput.setSelectionRange(start, end);
  }

  function selectHighlightedOrFirstItem() {
    if (activeRowIndex >= 0) {
      activateHighlightedListRow();
      return true;
    }
    return selectFirstVisibleItem();
  }

  function selectFirstVisibleItem() {
    if (multi || listRoot.classList.contains('list-root--loading')) return false;

    const firstInput = listRoot.querySelector('.list-item input');
    if (!firstInput) return false;

    firstInput.checked = true;
    firstInput.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function renderItems(items: any) {
    listRoot.innerHTML = '';
    const highlightQuery = searchInput.value.trim();

    for (const item of items) {
      const fullLabel = formatLabel(item);
      const row = document.createElement('label');
      row.className = 'list-item';
      row.dataset.label = fullLabel;

      const input = document.createElement('input');
      input.type = multi ? 'checkbox' : 'radio';
      if (!multi) input.name = 'list-modal-choice';
      // Keep arrow keys on the picker, not the browser radio-group navigator.
      input.tabIndex = -1;
      input.checked = selectedLabels.has(fullLabel);

      const text = document.createElement('span');
      text.className = 'list-item__label';
      if (showCode && item.code) {
        text.innerHTML =
          `<span class="list-item__code">${highlightText(item.code, highlightQuery)}</span> ${highlightText(item.label, highlightQuery)}`;
      } else {
        text.innerHTML = highlightText(item.label, highlightQuery);
      }

      row.appendChild(input);
      row.appendChild(text);
      listRoot.appendChild(row);
    }

    applyActiveListRowHighlight();
  }

  function renderList(filter: any = '') {
    const q = filter.toLowerCase().trim();

    const filtered = currentItems.filter((item) => {
      if (!q) return true;
      const text = `${item.code ?? ''} ${item.label}`.toLowerCase();
      return text.includes(q);
    });

    renderItems(filtered);

    if (q && !filtered.length) {
      setStatus('No results');
    } else {
      setStatus('');
    }
  }

  async function runRemoteSearch(query: any) {
    if (!remoteSearchFn) return;

    const generation = ++searchGeneration;
    const caret = captureSearchCaret();
    setLoading(true);
    setStatus('Searching…');

    try {
      const items = await remoteSearchFn(query);
      if (generation !== searchGeneration) return;

      currentItems = Array.isArray(items) ? items : [];
      rebuildCatalogLabelSet();
      if (allowManualEdit && multi) {
        selectedLabels = new Set(
          orderedLines.filter((entry) => catalogLabelSet.has(entry)),
        );
        rebuildManualEditTextarea();
      }
      activeRowIndex = -1;
      renderItems(currentItems);
      highlightFirstSearchMatch();

      const trimmed = query.trim();
      if (!currentItems.length) {
        setStatus(trimmed ? 'No results' : 'Type to search');
      } else if (currentItems.length >= 50 && trimmed) {
        setStatus(`Showing ${currentItems.length} matches — type more to narrow`);
      } else {
        setStatus('');
      }
    } catch (err: any) {
      if (generation !== searchGeneration) return;
      currentItems = [];
      rebuildCatalogLabelSet();
      renderItems([]);
      setStatus(err?.message || 'Search failed', true);
    } finally {
      if (generation === searchGeneration) {
        setLoading(false);
        restoreSearchCaret(caret);
      }
    }
  }

  function scheduleRemoteSearch(query: any) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      runRemoteSearch(query);
    }, SEARCH_DEBOUNCE_MS);
  }

  function open({
    title,
    items,
    selected = [],
    withCode = false,
    multi: allowMulti = true,
    remoteSearch,
    allowManualEdit: manualEdit = false,
    initialText = '',
    textStyle = null,
  }: any) {
    return new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;

      allowManualEdit = !!manualEdit;
      remoteSearchFn = remoteSearch?.search ?? null;
      searchGeneration = 0;
      currentItems = items ?? [];
      showCode = withCode;
      multi = allowMulti;
      rebuildCatalogLabelSet();

      if (allowManualEdit) {
        const text = String(initialText ?? '').trim();
        const schemaType = multi ? 'list' : 'choice';
        orderedLines = parseCustomEntriesText(text);
        const { catalog, freeText } = splitManualEditLines(text, catalogLabelSet, schemaType);
        freeTextLines = freeText;
        selectedLabels = multi ? new Set(catalog) : new Set(catalog.length ? [catalog[0]] : []);
        if (customEntriesInput) customEntriesInput.value = text;
        if (customEntriesBlock) customEntriesBlock.hidden = false;
        searchInput.placeholder = remoteSearch?.search ? 'Type to search...' : 'Search...';
      } else {
        freeTextLines = [];
        orderedLines = [];
        const initial = Array.isArray(selected) ? selected : (selected ? [selected] : []);
        selectedLabels = multi ? new Set(initial) : new Set(initial.length ? [initial[0]] : []);
        if (customEntriesBlock) customEntriesBlock.hidden = true;
        searchInput.placeholder = remoteSearch?.search ? 'Type to search...' : 'Search...';
      }

      header.textContent = title;
      mountFieldModalOverlay(overlay, parent);
      overlay.hidden = false;
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      searchInput.value = '';
      activeRowIndex = -1;

      applyFieldFormTextStyle(modalEl, textStyle);
      applyFieldFormTextStyle(customEntriesInput, textStyle);

      if (remoteSearchFn) {
        setStatus('Type to search');
        runRemoteSearch('');
      } else {
        renderList();
      }

      renderSelectionSummary();

      // Defer past the opening click so the field token doesn't steal focus back.
      setTimeout(() => {
        if (overlay.hidden) return;
        searchInput.focus();
      }, 0);
    });
  }

  searchInput.addEventListener('input', () => {
    activeRowIndex = -1;
    if (remoteSearchFn) {
      if (currentItems.length) {
        renderItems(currentItems);
        highlightFirstSearchMatch();
      }
      scheduleRemoteSearch(searchInput.value);
      return;
    }
    renderList(searchInput.value);
    highlightFirstSearchMatch();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (isPickerArrowKey(e.key)) {
      e.preventDefault();
    }
    if (e.key !== 'Enter') return;
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    selectHighlightedOrFirstItem();
    searchInput.focus();
    searchInput.select?.();
  });

  // window capture runs before document/Editor.js listeners.
  window.addEventListener('keydown', onWindowPickerKeydown, true);

  wireModalConfirmShortcut(overlay, btnOk);

  btnOk.addEventListener('click', () => {
    confirmSelection();
  });

  btnClear.addEventListener('click', () => {
    if (allowManualEdit) {
      selectedLabels = new Set();
      freeTextLines = [];
      orderedLines = [];
      if (customEntriesInput) customEntriesInput.value = '';
      renderSelectionSummary();
      if (remoteSearchFn && currentItems.length) {
        renderItems(currentItems);
      } else {
        renderList(searchInput.value);
      }
      return;
    }

    const resolve = resolvePromise;
    close();
    resolve?.([]);
    resolvePromise = null;
    rejectPromise = null;
  });

  btnClose.addEventListener('click', () => {
    rejectPromise?.(new Error('cancelled'));
    resolvePromise = null;
    rejectPromise = null;
    close();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      btnClose.click();
    }
  });

  wireModalEscape(overlay, () => btnClose.click());

  return { open };
}
