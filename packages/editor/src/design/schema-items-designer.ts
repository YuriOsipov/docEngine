import { createDragHandle } from '../ui/drag-handle.js';

function escapeAttr(str: any) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function normalizeListItem(item: any,index: any) {
  const label = String(item?.label ?? '').trim();
  if (!label) return null;
  const id = String(item?.id ?? `item_${index + 1}`).trim() || `item_${index + 1}`;
  return { id, label };
}

export function normalizeListItems(items: any) {
  return (items ?? [])
    .map((item, index) => normalizeListItem(item, index))
    .filter(Boolean);
}

function normalizeTreeNode(node: any) {
  const label = String(node?.label ?? '').trim();
  if (!label) return null;
  const children = normalizeTreeNodes(node?.children ?? []);
  const entry: any = { label };
  if (children.length) entry.children = children;
  return entry;
}

/** Tree nodes stored in field schemas: label + optional children only (no ids). */
export function normalizeTreeNodes(nodes: any) {
  return (nodes ?? [])
    .map((node) => normalizeTreeNode(node))
    .filter(Boolean);
}

export function countTreeNodes(nodes: any) {
  let count = 0;
  for (const node of nodes ?? []) {
    count += 1;
    count += countTreeNodes(node.children);
  }
  return count;
}

function exportTreeLines(nodes: any,depth: any = 0) {
  const lines: any[] = [];
  for (const node of normalizeTreeNodes(nodes)) {
    lines.push(`${'\t'.repeat(depth)}${node.label}`);
    if (node.children?.length) {
      lines.push(...exportTreeLines(node.children, depth + 1));
    }
  }
  return lines;
}

export function exportTreeNodesText(tree: any) {
  const lines = exportTreeLines(tree);
  return lines.length ? `${lines.join('\n')}\n` : '';
}

export function parseTreeNodesText(text: any) {
  const roots: any[] = [];
  /** @type {{ depth: number, children: Array<{ label: string, children?: unknown[] }> }[]} */
  const stack = [{ depth: -1, children: roots }];
  let prevDepth = -1;
  let lineNumber = 0;

  for (const rawLine of String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    lineNumber += 1;
    if (!rawLine.trim()) continue;

    let depth = 0;
    while (depth < rawLine.length && rawLine[depth] === '\t') depth += 1;
    const label = rawLine.slice(depth).trim();
    if (!label) continue;

    if (depth > prevDepth + 1) {
      throw new Error(
        `Invalid indentation at line ${lineNumber}: depth jumped from ${prevDepth} to ${depth}.`,
      );
    }

    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const node = { label, children: [] };
    stack[stack.length - 1].children.push(node);
    stack.push({ depth, children: node.children });
    prevDepth = depth;
  }

  return normalizeTreeNodes(roots);
}

export function exportListItemsText(items: any) {
  const lines = normalizeListItems(items).map((item) => item.label);
  return lines.length ? `${lines.join('\n')}\n` : '';
}

export function parseListItemsText(text: any) {
  const labels = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return normalizeListItems(labels.map((label) => ({ label })));
}

export function createListItemsEditor(container: any,items: any = []) {
  const root = document.createElement('div');
  root.className = 'schema-items-editor';
  container.appendChild(root);

  const list = document.createElement('div');
  list.className = 'schema-items';
  root.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btn-sm';
  addBtn.textContent = '+ Add option';
  list.appendChild(addBtn);

  let draggedRow: any = null;

  function clearListDropIndicators() {
    list.querySelectorAll('.schema-items__row.is-drop-before, .schema-items__row.is-drop-after').forEach((el) => {
      el.classList.remove('is-drop-before', 'is-drop-after');
    });
  }

  function getListDropMode(row: any,clientY: any) {
    const rect = row.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  }

  function setListDropIndicator(targetRow: any,mode: any) {
    clearListDropIndicators();
    targetRow.classList.add(mode === 'before' ? 'is-drop-before' : 'is-drop-after');
  }

  function applyListDrop(source: any,target: any,mode: any) {
    if (!source || !target || source === target) return;
    if (mode === 'before') {
      list.insertBefore(source, target);
    } else {
      list.insertBefore(source, target.nextSibling);
    }
  }

  function wireListRowDragDrop(row: any) {
    const handle = row.querySelector('[data-drag-handle]');
    if (!handle) return;

    handle.addEventListener('dragstart', (e) => {
      draggedRow = row;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', row.querySelector('[data-item-label]')?.value || 'option');
    });

    handle.addEventListener('dragend', () => {
      row.classList.remove('is-dragging');
      clearListDropIndicators();
      draggedRow = null;
    });

    row.addEventListener('dragover', (e) => {
      if (!draggedRow || draggedRow === row) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setListDropIndicator(row, getListDropMode(row, e.clientY));
    });

    row.addEventListener('dragleave', (e) => {
      if (!row.contains(e.relatedTarget)) {
        row.classList.remove('is-drop-before', 'is-drop-after');
      }
    });

    row.addEventListener('drop', (e) => {
      if (!draggedRow || draggedRow === row) return;
      e.preventDefault();
      applyListDrop(draggedRow, row, getListDropMode(row, e.clientY));
      clearListDropIndicators();
    });
  }

  function addRow(item: any = { label: '' }) {
    const row = document.createElement('div');
    row.className = 'schema-items__row';
    const handle = createDragHandle({ dataset: { dragHandle: '' } });
    handle.draggable = true;
    row.appendChild(handle);
    row.insertAdjacentHTML(
      'beforeend',
      `<input type="text" data-item-label value="${escapeAttr(item.label)}" placeholder="Name" />
        <button type="button" class="btn-icon" data-remove-item title="Remove">×</button>`,
    );
    row.querySelector('[data-remove-item]').addEventListener('click', () => {
      row.remove();
    });
    wireListRowDragDrop(row);
    list.insertBefore(row, addBtn);
  }

  addBtn.addEventListener('click', () => addRow());

  const rows = normalizeListItems(items);
  const seed = rows.length ? rows : [{ id: 'item1', label: '' }];
  for (const item of seed) addRow(item);

  function collect() {
    return [...list.querySelectorAll('[data-item-label]')]
      .map((input, index) => normalizeListItem({ label: input.value }, index))
      .filter(Boolean);
  }

  function setItems(nextItems: any) {
    list.querySelectorAll('.schema-items__row').forEach((row) => row.remove());
    const normalized = normalizeListItems(nextItems);
    if (!normalized.length) {
      addRow();
      return;
    }
    for (const item of normalized) addRow(item);
  }

  return {
    getItems: collect,
    setItems,
  };
}

export function createTreeNodesEditor(container: any,nodes: any = []) {
  const root = document.createElement('div');
  root.className = 'schema-tree-editor';
  container.appendChild(root);

  let draggedTreeNode: any = null;

  function clearTreeDropIndicators() {
    root.querySelectorAll(
      '.schema-tree__node.is-drop-before, .schema-tree__node.is-drop-after, .schema-tree__node.is-drop-child, .schema-tree__children.is-drop-target',
    ).forEach((el) => {
      el.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-child', 'is-drop-target');
    });
  }

  function canDropTreeNode(source: any,target: any) {
    return Boolean(source && target && source !== target && !source.contains(target));
  }

  function getTreeDropMode(row: any,clientY: any) {
    const rect = row.getBoundingClientRect();
    const offset = clientY - rect.top;
    const zone = rect.height * 0.25;
    if (offset < zone) return 'before';
    if (offset > rect.height - zone) return 'after';
    return 'child';
  }

  function setTreeDropIndicator(targetNodeEl: any,mode: any) {
    clearTreeDropIndicators();
    if (mode === 'child') {
      targetNodeEl.classList.add('is-drop-child');
      return;
    }
    targetNodeEl.classList.add(mode === 'before' ? 'is-drop-before' : 'is-drop-after');
  }

  function applyTreeDrop(source: any,target: any,mode: any) {
    if (!canDropTreeNode(source, target)) return;
    if (mode === 'before') {
      target.parentElement.insertBefore(source, target);
    } else if (mode === 'after') {
      target.parentElement.insertBefore(source, target.nextSibling);
    } else {
      target.querySelector('.schema-tree__children')?.appendChild(source);
    }
  }

  function wireTreeDragDrop(nodeEl: any) {
    const handle = nodeEl.querySelector('[data-drag-handle]');
    const row = nodeEl.querySelector('.schema-tree__row');
    const childrenEl = nodeEl.querySelector('.schema-tree__children');
    if (!handle || !row || !childrenEl) return;

    handle.addEventListener('dragstart', (e) => {
      draggedTreeNode = nodeEl;
      nodeEl.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', nodeEl.querySelector('[data-node-label]')?.value || 'node');
    });

    handle.addEventListener('dragend', () => {
      nodeEl.classList.remove('is-dragging');
      clearTreeDropIndicators();
      draggedTreeNode = null;
    });

    row.addEventListener('dragover', (e) => {
      if (!canDropTreeNode(draggedTreeNode, nodeEl)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setTreeDropIndicator(nodeEl, getTreeDropMode(row, e.clientY));
    });

    row.addEventListener('dragleave', (e) => {
      if (!row.contains(e.relatedTarget) && !childrenEl.contains(e.relatedTarget)) {
        nodeEl.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-child');
      }
    });

    row.addEventListener('drop', (e) => {
      if (!canDropTreeNode(draggedTreeNode, nodeEl)) return;
      e.preventDefault();
      applyTreeDrop(draggedTreeNode, nodeEl, getTreeDropMode(row, e.clientY));
      clearTreeDropIndicators();
    });

    childrenEl.addEventListener('dragover', (e) => {
      if (!canDropTreeNode(draggedTreeNode, nodeEl)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      clearTreeDropIndicators();
      childrenEl.classList.add('is-drop-target');
      nodeEl.classList.add('is-drop-child');
    });

    childrenEl.addEventListener('dragleave', (e) => {
      if (!childrenEl.contains(e.relatedTarget) && !row.contains(e.relatedTarget)) {
        childrenEl.classList.remove('is-drop-target');
        nodeEl.classList.remove('is-drop-child');
      }
    });

    childrenEl.addEventListener('drop', (e) => {
      if (!canDropTreeNode(draggedTreeNode, nodeEl)) return;
      e.preventDefault();
      e.stopPropagation();
      childrenEl.appendChild(draggedTreeNode);
      clearTreeDropIndicators();
    });
  }

  function createTreeNodeElement(label: any = '') {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'schema-tree__node';
    const row = document.createElement('div');
    row.className = 'schema-tree__row';
    const handle = createDragHandle({ dataset: { dragHandle: '' } });
    handle.draggable = true;
    row.appendChild(handle);
    row.insertAdjacentHTML(
      'beforeend',
      `<input type="text" data-node-label value="${escapeAttr(label)}" placeholder="Node name" />
        <button type="button" class="btn-icon" data-add-child title="Child">+</button>
        <button type="button" class="btn-icon" data-remove-node title="Remove">×</button>`,
    );
    const childrenEl = document.createElement('div');
    childrenEl.className = 'schema-tree__children';
    nodeEl.appendChild(row);
    nodeEl.appendChild(childrenEl);
    wireTreeNode(nodeEl);
    return nodeEl;
  }

  function wireTreeNode(nodeEl: any) {
    wireTreeDragDrop(nodeEl);
    nodeEl.querySelector('[data-add-child]')?.addEventListener('click', () => {
      nodeEl.querySelector('.schema-tree__children')?.appendChild(createTreeNodeElement());
    });
    nodeEl.querySelector('[data-remove-node]')?.addEventListener('click', () => nodeEl.remove());
  }

  function buildTreeNodeFromData(node: any) {
    const nodeEl = createTreeNodeElement(node.label ?? '');
    const childrenEl = nodeEl.querySelector('.schema-tree__children');
    for (const child of node.children ?? []) {
      childrenEl.appendChild(buildTreeNodeFromData(child));
    }
    return nodeEl;
  }

  const treeRoot = document.createElement('div');
  treeRoot.className = 'schema-tree-root';

  const wrap = document.createElement('div');
  wrap.className = 'schema-tree';

  const scroll = document.createElement('div');
  scroll.className = 'schema-tree-scroll schema-tree-scroll--modal';
  scroll.appendChild(wrap);

  const addRoot = document.createElement('button');
  addRoot.type = 'button';
  addRoot.className = 'btn btn-sm';
  addRoot.textContent = '+ Add node';
  addRoot.addEventListener('click', () => {
    wrap.appendChild(createTreeNodeElement());
  });

  treeRoot.appendChild(scroll);
  treeRoot.appendChild(addRoot);
  root.appendChild(treeRoot);

  function collectTreeNodes(containerEl: any) {
    const collected: any[] = [];
    containerEl.querySelectorAll(':scope > .schema-tree__node').forEach((nodeEl) => {
      const label = nodeEl.querySelector(':scope > .schema-tree__row [data-node-label]')?.value?.trim();
      if (!label) return;
      const childrenEl = nodeEl.querySelector(':scope > .schema-tree__children');
      const childNodes = childrenEl ? collectTreeNodes(childrenEl) : [];
      const node: any = { label };
      if (childNodes.length) node.children = childNodes;
      collected.push(node);
    });
    return normalizeTreeNodes(collected);
  }

  function setTree(nextNodes: any) {
    wrap.innerHTML = '';
    const normalized = normalizeTreeNodes(nextNodes);
    if (!normalized.length) return;
    for (const node of normalized) {
      wrap.appendChild(buildTreeNodeFromData(node));
    }
  }

  setTree(nodes);

  return {
    getTree: () => collectTreeNodes(wrap),
    setTree,
  };
}
