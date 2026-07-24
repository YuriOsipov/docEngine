import { PALETTE_BLOCK_MIME, parsePaletteDrag } from './field-palette.js';

function resolveBlockInsertIndex(holder: any,clientY: any) {
  const blocks = [...holder.querySelectorAll('.ce-block')];
  for (let i = 0; i < blocks.length; i++) {
    const rect = blocks[i].getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (clientY < mid) return i;
  }
  return blocks.length;
}

/**
 * Allow dropping a Section block between EditorJS blocks.
 * @param {HTMLElement} holder
 * @param {{ onInsertSection: (index: number) => void | Promise<void> }} options
 */
export function wirePaletteBlockDrop(holder: any,options: any = {}) {
  if (holder.dataset.paletteBlockDropWired === 'true') return;
  holder.dataset.paletteBlockDropWired = 'true';

  let dropIndex: any = null;

  function clearBlockDropState() {
    dropIndex = null;
    holder.classList.remove('editor-holder--palette-drop');
    for (const block of holder.querySelectorAll('.ce-block.is-drop-before-block')) {
      block.classList.remove('is-drop-before-block');
    }
  }

  function showBlockDropIndicator(index: any) {
    clearBlockDropState();
    dropIndex = index;
    holder.classList.add('editor-holder--palette-drop');
    const blocks = [...holder.querySelectorAll('.ce-block')];
    if (index < blocks.length) {
      blocks[index].classList.add('is-drop-before-block');
    }
  }

  holder.addEventListener('dragover', (e: any) => {
    if (!e.dataTransfer.types.includes(PALETTE_BLOCK_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    showBlockDropIndicator(resolveBlockInsertIndex(holder, e.clientY));
  });

  holder.addEventListener('dragleave', (e: any) => {
    if (!holder.contains(e.relatedTarget)) {
      clearBlockDropState();
    }
  });

  holder.addEventListener('drop', async (e: any) => {
    const item = parsePaletteDrag(e.dataTransfer);
    if (!item || item.kind !== 'block' || item.type !== 'documentSection') return;
    e.preventDefault();
    e.stopPropagation();
    const index = dropIndex ?? resolveBlockInsertIndex(holder, e.clientY);
    clearBlockDropState();
    await options.onInsertSection?.(index);
  });

  holder.addEventListener('dragend', clearBlockDropState);
}
