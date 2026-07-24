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
    result += `<mark class="collection-tree-picker__highlight">${escapeHtml(raw.slice(index, index + q.length))}</mark>`;
    start = index + q.length;
    index = lower.indexOf(lowerQ, start);
  }

  result += escapeHtml(raw.slice(start));
  return result;
}

function nodeMatchesQuery(node: any,query: any) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (node.label.toLowerCase().includes(q)) return true;
  if (node.id.toLowerCase().includes(q)) return true;
  if (node.collectionId?.toLowerCase().includes(q)) return true;
  return (node.children ?? []).some((child) => nodeMatchesQuery(child, query));
}

function selectionKey(node: any) {
  if (node.kind === 'preset') return `preset:${node.presetId ?? node.id}`;
  return node.collectionId ?? node.id;
}

/**
 * @param {import('../types.d.ts').RemoteListCollectionTreeNode[]} nodes
 * @param {string} query
 * @param {(selection: { collectionId: string, presetId?: string, label: string, key: string }) => void} onSelect
 * @param {string} selectedKey
 */
function renderTreeNodes(nodes: any,query: any,onSelect: any,selectedKey: any) {
  const fragment = document.createDocumentFragment();

  for (const node of nodes ?? []) {
    if (!nodeMatchesQuery(node, query)) continue;

    if (node.kind === 'folder' && node.children?.length) {
      const item = document.createElement('div');
      item.className = 'collection-tree-picker__node collection-tree-picker__node--folder';

      const details = document.createElement('details');
      details.open = Boolean(query.trim());
      const summary = document.createElement('summary');
      summary.className = 'collection-tree-picker__summary';
      summary.innerHTML = highlightText(node.label, query);
      details.appendChild(summary);

      const children = document.createElement('div');
      children.className = 'collection-tree-picker__children';
      children.append(...renderTreeNodes(node.children, query, onSelect, selectedKey).childNodes);
      details.appendChild(children);
      item.appendChild(details);
      fragment.appendChild(item);
      continue;
    }

    if (node.kind === 'collection' && node.children?.length) {
      const item = document.createElement('div');
      item.className = 'collection-tree-picker__node collection-tree-picker__node--collection';

      const details = document.createElement('details');
      const collectionKey = selectionKey(node);
      details.open = Boolean(query.trim())
        || collectionKey === selectedKey
        || node.children.some((child) => selectionKey(child) === selectedKey);

      const summary = document.createElement('summary');
      summary.className = 'collection-tree-picker__summary collection-tree-picker__summary--collection';
      summary.title = node.collectionId ?? node.id;

      const selectButton = document.createElement('button');
      selectButton.type = 'button';
      selectButton.className = 'collection-tree-picker__collection-select';
      if (collectionKey === selectedKey) {
        selectButton.classList.add('collection-tree-picker__collection-select--selected');
      }
      selectButton.innerHTML = highlightText(node.label, query);
      selectButton.addEventListener('click', (event) => {
        event.stopPropagation();
        onSelect({
          collectionId: node.collectionId ?? node.id,
          label: node.label,
          key: collectionKey,
        });
      });
      summary.appendChild(selectButton);
      details.appendChild(summary);

      const children = document.createElement('div');
      children.className = 'collection-tree-picker__children';
      children.append(...renderTreeNodes(node.children, query, onSelect, selectedKey).childNodes);
      details.appendChild(children);
      item.appendChild(details);
      fragment.appendChild(item);
      continue;
    }

    if (node.kind === 'collection') {
      const row = document.createElement('div');
      row.className = 'collection-tree-picker__leaf-row';
      if (selectionKey(node) === selectedKey) {
        row.classList.add('collection-tree-picker__leaf-row--selected');
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'collection-tree-picker__leaf';
      button.innerHTML = highlightText(node.label, query);
      button.title = node.collectionId ?? node.id;
      button.addEventListener('click', () => onSelect({
        collectionId: node.collectionId ?? node.id,
        label: node.label,
        key: selectionKey(node),
      }));
      row.appendChild(button);
      fragment.appendChild(row);
      continue;
    }

    if (node.kind === 'preset') {
      const row = document.createElement('div');
      row.className = 'collection-tree-picker__leaf-row collection-tree-picker__leaf-row--preset';
      if (selectionKey(node) === selectedKey) {
        row.classList.add('collection-tree-picker__leaf-row--selected');
      }

      const icon = document.createElement('span');
      icon.className = 'collection-tree-picker__preset-icon';
      icon.textContent = '🔖';
      row.appendChild(icon);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'collection-tree-picker__leaf collection-tree-picker__leaf--preset';
      button.innerHTML = highlightText(node.label, query);
      button.title = `${node.label} (${node.collectionId ?? ''})`;
      button.addEventListener('click', () => onSelect({
        collectionId: node.collectionId ?? '',
        presetId: node.presetId,
        label: node.label,
        key: selectionKey(node),
      }));
      row.appendChild(button);
      fragment.appendChild(row);
    }
  }

  return fragment;
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   getCatalog: () => import('../types.d.ts').RemoteListCollectionCatalog | Promise<import('../types.d.ts').RemoteListCollectionCatalog>,
 *   initialCollectionId?: string,
 *   initialPresetId?: string,
 *   onSelect?: (collectionId: string, presetId?: string) => void,
 * }} options
 */
export function renderCollectionTreePicker(host: any,{
  getCatalog,
  initialCollectionId = '',
  initialPresetId = '',
  onSelect = null,
}: any = {}) {
  host.innerHTML = '';
  host.className = 'collection-tree-picker';

  const hiddenCollectionInput = document.createElement('input');
  hiddenCollectionInput.type = 'hidden';
  hiddenCollectionInput.dataset.field = 'sourceCollection';
  hiddenCollectionInput.value = initialCollectionId;

  const hiddenPresetInput = document.createElement('input');
  hiddenPresetInput.type = 'hidden';
  hiddenPresetInput.dataset.field = 'sourcePresetId';
  hiddenPresetInput.value = initialPresetId;

  function formatSelectedLabel(collectionId: any,presetId: any,label: any) {
    if (!collectionId) return 'No collection selected';
    const displayLabel = label || collectionId;
    if (presetId) return `${displayLabel} · ${collectionId}`;
    return `${displayLabel} (${collectionId})`;
  }

  const selectedRow = document.createElement('div');
  selectedRow.className = 'collection-tree-picker__selected';
  selectedRow.dataset.role = 'selected-label';
  selectedRow.textContent = formatSelectedLabel(initialCollectionId, initialPresetId, '');

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'collection-tree-picker__search';
  searchInput.placeholder = 'Search collections and bookmarks…';

  const treeHost = document.createElement('div');
  treeHost.className = 'collection-tree-picker__tree';

  const statusEl = document.createElement('p');
  statusEl.className = 'schema-form__hint collection-tree-picker__status';
  statusEl.hidden = true;

  host.appendChild(hiddenCollectionInput);
  host.appendChild(hiddenPresetInput);
  host.appendChild(selectedRow);
  host.appendChild(searchInput);
  host.appendChild(treeHost);
  host.appendChild(statusEl);

  let catalog = { bookmarks: [], tree: [] };
  let selectedKey = initialPresetId ? `preset:${initialPresetId}` : initialCollectionId;
  let selectedLabel = '';

  function updateSelectedRow() {
    selectedRow.textContent = formatSelectedLabel(
      hiddenCollectionInput.value,
      hiddenPresetInput.value,
      selectedLabel,
    );
  }

  function setSelected({ collectionId, presetId = '', label = '', key = '' }: any) {
    const normalizedPresetId = presetId != null && String(presetId).trim() !== ''
      ? String(presetId).trim()
      : '';
    selectedKey = key || (normalizedPresetId ? `preset:${normalizedPresetId}` : collectionId);
    selectedLabel = label || collectionId;
    hiddenCollectionInput.value = collectionId;
    hiddenPresetInput.value = normalizedPresetId;
    updateSelectedRow();
    onSelect?.(collectionId, normalizedPresetId || undefined);
    renderTree();
  }

  function renderTree() {
    treeHost.innerHTML = '';
    const query = searchInput.value ?? '';
    const nodes = renderTreeNodes(catalog.tree ?? [], query, setSelected, selectedKey);

    if (!nodes.childNodes.length) {
      const empty = document.createElement('p');
      empty.className = 'schema-form__hint';
      empty.textContent = query.trim()
        ? 'No collections or bookmarks match your search.'
        : 'No collections available.';
      treeHost.appendChild(empty);
      return;
    }

    treeHost.appendChild(nodes);
  }

  async function refresh() {
    statusEl.hidden = true;
    treeHost.innerHTML = '';
    treeHost.textContent = 'Loading collections…';

    try {
      catalog = await getCatalog();
      const match = findSelectionLabel(catalog, selectedKey, hiddenCollectionInput.value, hiddenPresetInput.value);
      if (match) selectedLabel = match;
      updateSelectedRow();
      renderTree();
    } catch (err: any) {
      treeHost.innerHTML = '';
      statusEl.hidden = false;
      statusEl.textContent = err?.message ?? 'Could not load collections.';
      statusEl.classList.add('schema-form__hint--error');
    }
  }

  searchInput.addEventListener('input', () => {
    renderTree();
  });

  void refresh();

  return {
    hiddenInput: hiddenCollectionInput,
    refresh,
    setSelected,
    getSelectedCollection: () => hiddenCollectionInput.value,
    getSelectedPresetId: () => hiddenPresetInput.value,
  };
}

function findSelectionLabel(catalog: any,selectedKey: any,collectionId: any,presetId: any) {
  const normalizedPresetId = presetId != null ? String(presetId).trim() : '';

  function walk(nodes: any) {
    for (const node of nodes ?? []) {
      if (node.kind === 'preset') {
        if (
          selectionKey(node) === selectedKey
          || (normalizedPresetId && String(node.presetId) === normalizedPresetId)
        ) {
          return node.label;
        }
        continue;
      }

      if (node.children?.length) {
        const nested = walk(node.children);
        if (nested) return nested;
      }

      if (node.kind === 'collection') {
        if (selectionKey(node) === selectedKey) {
          return node.label;
        }
        if (!normalizedPresetId && node.collectionId === collectionId) {
          return node.label;
        }
      }
    }
    return null;
  }

  return walk(catalog.tree ?? []);
}
