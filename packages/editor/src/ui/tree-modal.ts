import { collectSelectedPaths, pathsToLeafIds, ensureTreeIds, buildPath } from '../fields/tree.js';
import {
  collectTreeLeafPaths,
  formatManualEditText,
  parseCustomEntriesText,
  parseManualEditText,
  splitManualEditLines,
  syncManualEditTextareaOrder,
} from '../fields/manual-field-values.js';
import { wireModalEscape } from './wire-modal-escape.js';
import { wireModalResize } from './wire-modal-resize.js';
import { FIELD_PICKER_POSITION_COOKIE, wireModalMove } from './wire-modal-move.js';
import {
  FIELD_TREE_PICKER_FOOTER_HINT_HTML,
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
  navigatePickerRowIndex,
  setPickerRowActive,
  shouldIgnorePickerNavigation,
} from './modal-picker-keyboard.js';
import { applyFieldFormTextStyle } from '../core/page-setup-styles.js';

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

function subtreeHasMatch(node: any,ancestors: any,query: any) {
  const q = query.toLowerCase().trim();
  if (!q) return true;

  const path = buildPath(ancestors, node).toLowerCase();
  if (path.includes(q) || node.label.toLowerCase().includes(q)) return true;

  for (const child of node.children ?? []) {
    if (subtreeHasMatch(child, [...ancestors, node.label], query)) return true;
  }

  return false;
}

function isTreePickerOverlay(el: Element) {
  return [...el.children].some((child) => child.classList?.contains('modal--tree'));
}

export function createTreeModal({ parent = null }: { parent?: HTMLElement | null } = {}) {
  // Only remove *tree picker* overlays. A field-mapping overlay can contain a
  // leftover nested tree dialog after the mapping editor closes; matching any
  // descendant `.modal--tree` would delete the mapping overlay itself and
  // prevent opening Mapping a second time.
  document.querySelectorAll('.modal-overlay').forEach((el) => {
    if (isTreePickerOverlay(el)) el.remove();
  });

  const overlay = document.createElement('div');
  overlay.className = FIELD_MODAL_OVERLAY_CLASS;
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="modal modal--tree" role="dialog" aria-modal="true">
      <div class="modal__header"></div>
      <div class="modal__body">
        <div class="tree-root"></div>
        <label class="modal__custom-entries" hidden>
          <span class="modal__custom-entries-label">Custom entries</span>
          <textarea class="modal__custom-entries-input" rows="2" placeholder="Semicolon-separated paths"></textarea>
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
        ${FIELD_TREE_PICKER_FOOTER_HINT_HTML}
        <button type="button" class="btn" data-action="close">Close</button>
      </div>
    </div>
  `;

  mountFieldModalOverlay(overlay, parent);

  const modalEl = overlay.querySelector('.modal');
  wireModalResize(modalEl, { cookieKey: 'tree-picker' });
  wireModalMove(modalEl, { cookieKey: FIELD_PICKER_POSITION_COOKIE });

  const header = overlay.querySelector('.modal__header');
  const searchInput = overlay.querySelector('.modal__search');
  const statusEl = overlay.querySelector('.modal__status');
  const pillsRoot = overlay.querySelector('.modal__selection-pills');
  const treeRoot = overlay.querySelector('.tree-root');
  const customEntriesBlock = overlay.querySelector('.modal__custom-entries');
  const customEntriesInput = overlay.querySelector('.modal__custom-entries-input');
  const btnClear = overlay.querySelector('[data-action="clear"]');
  const btnOk = overlay.querySelector('[data-action="ok"]');
  const btnClose = overlay.querySelector('[data-action="close"]');

  let resolvePromise: any = null;
  let rejectPromise: any = null;
  let currentTree: any[] = [];
  let selectedIds = new Set();
  let expandedIds = new Set();
  let manualEditActive = false;
  let catalogLeafSet = new Set<string>();
  let _freeTextLines: any[] = [];
  let orderedLines: string[] = [];
  let activeRowIndex = -1;
  let previousBodyOverflow = '';

  const treeRowSelector = '.tree-node__row';

  function isManualEditMode() {
    return manualEditActive;
  }

  function close() {
    overlay.hidden = true;
    document.body.style.overflow = previousBodyOverflow;
    treeRoot.innerHTML = '';
    searchInput.value = '';
    selectedIds = new Set();
    expandedIds = new Set();
    manualEditActive = false;
    catalogLeafSet = new Set<string>();
    _freeTextLines = [];
    orderedLines = [];
    if (customEntriesInput) customEntriesInput.value = '';
    if (customEntriesBlock) customEntriesBlock.hidden = true;
    renderSelectionPills(pillsRoot, [], () => {});
    clearPickerRowActive(treeRoot);
    activeRowIndex = -1;
    setStatus('');
  }

  function removeSelectionLine(line: string) {
    const matchingIds = pathsToLeafIds(currentTree, [line]);
    for (const id of matchingIds) {
      selectedIds.delete(id);
    }
    if (!matchingIds.size) {
      orderedLines = orderedLines.filter((entry) => entry !== line);
      _freeTextLines = _freeTextLines.filter((entry) => entry !== line);
    }
    if (isManualEditMode()) {
      rebuildManualEditTextarea();
    } else {
      renderSelectionSummary();
    }
    refreshTree();
  }

  function rebuildManualEditTextarea() {
    if (!isManualEditMode() || !customEntriesInput) return;
    const catalogPaths = collectSelectedPaths(currentTree, selectedIds);
    const currentLines = parseCustomEntriesText(customEntriesInput.value);
    orderedLines = syncManualEditTextareaOrder(currentLines, catalogPaths, catalogLeafSet);
    _freeTextLines = orderedLines.filter((line) => !catalogLeafSet.has(line));
    customEntriesInput.value = formatManualEditText(orderedLines, 'tree');
    renderSelectionSummary();
  }

  function refreshManualEditFromInput() {
    if (!isManualEditMode()) return;
    orderedLines = parseCustomEntriesText(customEntriesInput?.value ?? '');
    _freeTextLines = orderedLines.filter((line) => !catalogLeafSet.has(line));
    selectedIds = pathsToLeafIds(currentTree, orderedLines);
    refreshTree();
  }

  function renderSelectionSummary() {
    const lines = isManualEditMode() ? [] : collectSelectedPaths(currentTree, selectedIds);
    renderSelectionPills(pillsRoot, lines, removeSelectionLine);
  }

  function updateSelectionFromCheckbox(checkbox: any) {
    const nodeEl = checkbox.closest('.tree-node');
    const nodeId = nodeEl?.dataset?.id;
    if (!nodeId || checkbox.disabled) return;

    if (checkbox.checked) {
      selectedIds.add(nodeId);
    } else {
      selectedIds.delete(nodeId);
    }

    if (isManualEditMode()) {
      rebuildManualEditTextarea();
    } else {
      renderSelectionSummary();
    }
  }

  treeRoot.addEventListener('change', (e) => {
    const checkbox = e.target;
    if (!checkbox?.classList?.contains('tree-node__checkbox')) return;
    updateSelectionFromCheckbox(checkbox);
  });

  if (customEntriesInput) {
    customEntriesInput.addEventListener('input', () => {
      refreshManualEditFromInput();
    });
  }

  function getVisibleTreeRows() {
    return getPickerRows(treeRoot, treeRowSelector);
  }

  function getActiveTreeNodeId() {
    if (activeRowIndex < 0) return null;
    return getVisibleTreeRows()[activeRowIndex]?.closest('.tree-node')?.dataset?.id ?? null;
  }

  function setActiveTreeRowFromElement(row: Element | null) {
    const rows = getVisibleTreeRows();
    const index = findPickerRowIndex(rows, row);
    if (index < 0) return;
    activeRowIndex = index;
    setPickerRowActive(rows, activeRowIndex, treeRoot);
  }

  function applyActiveTreeRowHighlight() {
    const rows = getVisibleTreeRows();
    if (activeRowIndex < 0 || activeRowIndex >= rows.length) {
      clearPickerRowActive(treeRoot);
      activeRowIndex = -1;
      return;
    }
    setPickerRowActive(rows, activeRowIndex, treeRoot);
  }

  /** Highlight the first row whose label matches the query (prefer a matching leaf). */
  function highlightFirstSearchMatch() {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      activeRowIndex = -1;
      applyActiveTreeRowHighlight();
      return;
    }
    const rows = getVisibleTreeRows();
    const matchIndexes = rows
      .map((row, index) => {
        const label = row.querySelector('.tree-node__label')?.textContent ?? '';
        return label.toLowerCase().includes(q) ? index : -1;
      })
      .filter((index) => index >= 0);

    const leafMatch = matchIndexes.find((index) =>
      rows[index]?.querySelector('.tree-node__checkbox:not(:disabled)'),
    );
    activeRowIndex = leafMatch ?? matchIndexes[0] ?? -1;
    applyActiveTreeRowHighlight();
  }

  function expandOrCollapseActiveTreeRow(direction: 'expand' | 'collapse') {
    const rows = getVisibleTreeRows();
    const row = rows[activeRowIndex];
    if (!row || activeRowIndex < 0) return false;

    const nodeId = row.closest('.tree-node')?.dataset?.id;
    const hasChildren = !!row.querySelector('.tree-node__toggle:not(.tree-node__toggle--leaf)');
    if (!hasChildren || !nodeId) return false;

    if (direction === 'expand' && !expandedIds.has(nodeId)) {
      expandedIds.add(nodeId);
      refreshTree();
      return true;
    }

    if (direction === 'collapse' && expandedIds.has(nodeId)) {
      expandedIds.delete(nodeId);
      refreshTree();
      return true;
    }

    return false;
  }

  function activateHighlightedTreeRow() {
    const rows = getVisibleTreeRows();
    const row = rows[activeRowIndex];
    if (!row) return;

    const nodeEl = row.closest('.tree-node');
    const nodeId = nodeEl?.dataset?.id;
    const checkbox = row.querySelector('.tree-node__checkbox') as HTMLInputElement | null;
    const hasChildren = !!row.querySelector('.tree-node__toggle:not(.tree-node__toggle--leaf)');

    if (hasChildren && nodeId) {
      if (expandedIds.has(nodeId)) {
        expandedIds.delete(nodeId);
      } else {
        expandedIds.add(nodeId);
      }
      refreshTree();
      return;
    }

    if (checkbox && !checkbox.disabled) {
      checkbox.checked = !checkbox.checked;
      updateSelectionFromCheckbox(checkbox);
    }
  }

  function handleTreePickerNavigation(event: KeyboardEvent) {
    if (overlay.hidden || shouldIgnorePickerNavigation(event.target)) return false;

    const rows = getVisibleTreeRows();
    if (!rows.length) return false;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      activeRowIndex = navigatePickerRowIndex(
        rows,
        activeRowIndex,
        event.key === 'ArrowDown' ? 'down' : 'up',
      );
      setPickerRowActive(rows, activeRowIndex, treeRoot);
      searchInput.focus({ preventScroll: true });
      return true;
    }

    if (event.key === 'ArrowRight') {
      expandOrCollapseActiveTreeRow('expand');
      searchInput.focus({ preventScroll: true });
      return true;
    }

    if (event.key === 'ArrowLeft') {
      expandOrCollapseActiveTreeRow('collapse');
      searchInput.focus({ preventScroll: true });
      return true;
    }

    if (event.key === ' ' && activeRowIndex >= 0) {
      activateHighlightedTreeRow();
      searchInput.focus({ preventScroll: true });
      return true;
    }

    return false;
  }

  function onWindowPickerKeydown(e: KeyboardEvent) {
    if (overlay.hidden) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (shouldIgnorePickerNavigation(e.target)) return;

    if (isPickerArrowKey(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!overlay.contains(document.activeElement)) {
        searchInput.focus({ preventScroll: true });
      }
      handleTreePickerNavigation(e);
      return;
    }

    if (e.key === ' ') {
      if (handleTreePickerNavigation(e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
  }

  function setStatus(message: any) {
    if (!statusEl) return;
    statusEl.textContent = message || '\u00a0';
    statusEl.classList.toggle('modal__status--empty', !message);
  }

  function selectHighlightedOrFirstLeaf() {
    if (activeRowIndex >= 0) {
      activateHighlightedTreeRow();
      return true;
    }
    return selectFirstVisibleLeaf();
  }

  function selectFirstVisibleLeaf() {
    const firstLeaf = treeRoot.querySelector('.tree-node__checkbox:not(:disabled)');
    if (!firstLeaf) return false;
    if (!firstLeaf.checked) {
      firstLeaf.checked = true;
      firstLeaf.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  function renderTree(nodes: any,ancestors: any = [],filter: any = '',highlightQuery: any = '') {
    const q = filter.toLowerCase().trim();
    const fragment = document.createDocumentFragment();

    for (const node of nodes) {
      if (q && !subtreeHasMatch(node, ancestors, q)) continue;

      const hasChildren = node.children?.length > 0;
      const isExpanded = q
        ? hasChildren && node.children.some((child) => subtreeHasMatch(child, [...ancestors, node.label], q))
        : expandedIds.has(node.id);
      const isLeaf = !hasChildren;

      const nodeEl = document.createElement('div');
      nodeEl.className = 'tree-node';
      nodeEl.dataset.id = node.id;

      const row = document.createElement('div');
      row.className = 'tree-node__row';

      const toggle = document.createElement('span');
      toggle.className = `tree-node__toggle${
        hasChildren ? (isExpanded ? ' tree-node__toggle--open' : '') : ' tree-node__toggle--leaf'
      }`;
      toggle.setAttribute('aria-hidden', 'true');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'tree-node__checkbox';
      checkbox.tabIndex = -1;
      checkbox.checked = isLeaf && selectedIds.has(node.id);
      checkbox.disabled = !isLeaf;

      const label = document.createElement('span');
      label.className = 'tree-node__label';
      label.innerHTML = highlightText(node.label, highlightQuery);

      row.appendChild(toggle);
      row.appendChild(checkbox);
      row.appendChild(label);
      nodeEl.appendChild(row);

      if (hasChildren) {
        const childrenEl = document.createElement('div');
        childrenEl.className = 'tree-node__children';
        childrenEl.hidden = !isExpanded;
        childrenEl.appendChild(renderTree(node.children, [...ancestors, node.label], filter, highlightQuery));
        nodeEl.appendChild(childrenEl);
      }

      row.addEventListener('click', (e) => {
        if (e.target === checkbox) return;

        setActiveTreeRowFromElement(row);
        searchInput.focus({ preventScroll: true });

        if (hasChildren) {
          if (expandedIds.has(node.id)) {
            expandedIds.delete(node.id);
          } else {
            expandedIds.add(node.id);
          }
          refreshTree();
        } else if (!checkbox.disabled) {
          const nextChecked = !checkbox.checked;
          checkbox.checked = nextChecked;
          updateSelectionFromCheckbox(checkbox);
        }
      });

      fragment.appendChild(nodeEl);
    }

    return fragment;
  }

  function refreshTree() {
    const activeNodeId = getActiveTreeNodeId();
    treeRoot.innerHTML = '';
    const filter = searchInput.value;
    const highlightQuery = filter.trim();

    treeRoot.appendChild(renderTree(currentTree, [], filter, highlightQuery));

    if (highlightQuery && !treeRoot.querySelector('.tree-node')) {
      setStatus('No matches found.');
    } else {
      setStatus('');
    }

    if (activeNodeId) {
      const rows = getVisibleTreeRows();
      activeRowIndex = rows.findIndex(
        (row) => row.closest('.tree-node')?.dataset?.id === activeNodeId,
      );
    }

    applyActiveTreeRowHighlight();
  }

  function expandToSelected(nodes: any) {
    function hasSelectedDescendant(node: any) {
      if (!node.children?.length) return selectedIds.has(node.id);
      return node.children.some(hasSelectedDescendant);
    }

    for (const node of nodes) {
      if (node.children?.length) {
        const childHasSelected = node.children.some((child) => {
          const isLeaf = !child.children?.length;
          return (isLeaf && selectedIds.has(child.id)) || false;
        });
        if (childHasSelected || node.children.some(hasSelectedDescendant)) {
          expandedIds.add(node.id);
        }
        expandToSelected(node.children);
      }
    }
  }

  function open({
    title,
    tree,
    selected = [],
    allowManualEdit: manualEdit = false,
    initialText = '',
    textStyle = null,
  }: any) {
    return new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;

      manualEditActive = !!manualEdit;
      currentTree = ensureTreeIds(tree);
      expandedIds = new Set();

      if (manualEditActive) {
        catalogLeafSet = new Set(collectTreeLeafPaths(currentTree));
        const text = String(initialText ?? '').trim();
        orderedLines = parseCustomEntriesText(text);
        const { freeText } = splitManualEditLines(text, catalogLeafSet, 'tree');
        _freeTextLines = freeText;
        selectedIds = pathsToLeafIds(currentTree, orderedLines);
        if (customEntriesInput) customEntriesInput.value = text;
        if (customEntriesBlock) customEntriesBlock.hidden = false;
        searchInput.placeholder = 'Search...';
      } else {
        catalogLeafSet = new Set<string>();
        _freeTextLines = [];
        orderedLines = [];
        selectedIds = pathsToLeafIds(currentTree, selected);
        if (customEntriesBlock) customEntriesBlock.hidden = true;
        searchInput.placeholder = 'Search...';
      }

      expandToSelected(currentTree);

      header.textContent = title;
      searchInput.value = '';
      activeRowIndex = -1;
      refreshTree();
      renderSelectionSummary();

      applyFieldFormTextStyle(modalEl, textStyle);
      applyFieldFormTextStyle(customEntriesInput, textStyle);

      mountFieldModalOverlay(overlay, parent);
      overlay.hidden = false;
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // Defer past the opening click so the field token doesn't steal focus back.
      setTimeout(() => {
        if (overlay.hidden) return;
        searchInput.focus();
      }, 0);
    });
  }

  searchInput.addEventListener('input', () => {
    activeRowIndex = -1;
    refreshTree();
    highlightFirstSearchMatch();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (isPickerArrowKey(e.key)) {
      e.preventDefault();
    }
    if (e.key !== 'Enter') return;
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    selectHighlightedOrFirstLeaf();
    searchInput.focus();
    searchInput.select?.();
  });

  window.addEventListener('keydown', onWindowPickerKeydown, true);

  wireModalConfirmShortcut(overlay, btnOk);

  btnOk.addEventListener('click', () => {
    const resolve = resolvePromise;
    const result = manualEditActive
      ? parseManualEditText(customEntriesInput?.value ?? '', 'tree')
      : collectSelectedPaths(currentTree, selectedIds);
    close();
    resolve?.(result);
    resolvePromise = null;
    rejectPromise = null;
  });

  btnClear.addEventListener('click', () => {
    if (manualEditActive) {
      selectedIds = new Set();
      _freeTextLines = [];
      orderedLines = [];
      if (customEntriesInput) customEntriesInput.value = '';
      renderSelectionSummary();
      refreshTree();
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

let sharedTreeModal: any = null;

/** Single tree picker instance shared by all editors. */
export function getTreeModal() {
  if (!sharedTreeModal) {
    sharedTreeModal = createTreeModal();
  }
  return sharedTreeModal;
}
