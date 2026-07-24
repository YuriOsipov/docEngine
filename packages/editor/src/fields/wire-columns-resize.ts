import {
  clampColumnWidthPx,
  redistributeAdjacentWidths,
  widthsPxToPercents,
  MIN_COLUMN_WIDTH_PX,
} from './wire-table-column-resize.js';

const SPLITTER_TRACK_PX = 12;

function measureColumnElementsPx(gridEl: any) {
  return [...gridEl.querySelectorAll(':scope > .document-columns__col')].map((col: any) => {
    const rect = col.getBoundingClientRect?.();
    if (rect?.width > 0) return rect.width;
    return MIN_COLUMN_WIDTH_PX;
  });
}

function measureGridTrackSpacePx(gridEl: any) {
  const rect = gridEl.getBoundingClientRect?.();
  if (rect?.width > 0) {
    const hasSplitter = !!gridEl.querySelector(':scope > .document-columns__col-resizer');
    return Math.max(1, rect.width - (hasSplitter ? SPLITTER_TRACK_PX : 0));
  }
  const sum = measureColumnElementsPx(gridEl).reduce((total: any, w: any) => total + w, 0);
  return sum > 0 ? sum : 1;
}

function applyGridWidthsPx(gridEl: any, widthsPx: any) {
  if ((widthsPx ?? []).length < 2) return;
  const hasSplitter = !!gridEl.querySelector(':scope > .document-columns__col-resizer');
  const left = `${clampColumnWidthPx(widthsPx[0])}px`;
  const right = `${clampColumnWidthPx(widthsPx[1])}px`;
  gridEl.style.gridTemplateColumns = hasSplitter
    ? `${left} ${SPLITTER_TRACK_PX}px ${right}`
    : `${left} ${right}`;
}

function widthsPxToGridPercents(widthsPx: any, gridEl: any) {
  const percents = widthsPxToPercents(widthsPx, measureGridTrackSpacePx(gridEl));
  return percents.map((pct: any) => (pct == null ? '' : `${pct}%`));
}

function suppressNextDocumentClick() {
  const suppress = (event: any) => {
    event.preventDefault();
    event.stopPropagation();
    document.removeEventListener('click', suppress, true);
  };
  document.addEventListener('click', suppress, true);
  setTimeout(() => {
    document.removeEventListener('click', suppress, true);
  }, 0);
}

/**
 * Wire drag-to-resize on a two-column layout block (`.document-columns`).
 * Handle is `.document-columns__col-resizer[data-col-index]` (middle grid track).
 */
export function wireColumnsResize(columnsEl: any, options: any = {}) {
  if (!columnsEl?.querySelector) return;
  if (columnsEl.dataset.columnsResizeWired === 'true') return;

  const handle = columnsEl.querySelector(':scope > .document-columns__grid > .document-columns__col-resizer')
    ?? columnsEl.querySelector('.document-columns__col-resizer');
  const grid = columnsEl.querySelector('.document-columns__grid');
  if (!handle || !grid) return;

  columnsEl.dataset.columnsResizeWired = 'true';
  const minWidthPx = options.minWidthPx ?? MIN_COLUMN_WIDTH_PX;

  handle.addEventListener('mousedown', (event: any) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const colIndex = Number(handle.dataset.colIndex);
    if (!Number.isInteger(colIndex) || colIndex < 0) return;

    const startX = Number(event.clientX) || 0;
    const measured = measureColumnElementsPx(grid);
    if (measured.length < 2) return;

    let liveWidths = [...measured];
    let didDrag = false;

    handle.classList.add('document-columns__col-resizer--active');
    grid.classList.add('document-columns__grid--resizing');
    document.body.classList.add('document-columns-col-resize-active');

    function applyLiveWidths() {
      applyGridWidthsPx(grid, liveWidths);
    }

    function onMove(moveEvent: any) {
      const clientX = Number(moveEvent.clientX) || 0;
      if (Math.abs(clientX - startX) > 2) didDrag = true;
      liveWidths = redistributeAdjacentWidths(measured, colIndex, clientX - startX, minWidthPx);
      applyLiveWidths();
    }

    function onUp(upEvent: any) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      handle.classList.remove('document-columns__col-resizer--active');
      grid.classList.remove('document-columns__grid--resizing');
      document.body.classList.remove('document-columns-col-resize-active');

      upEvent?.preventDefault?.();
      upEvent?.stopPropagation?.();
      if (didDrag) suppressNextDocumentClick();

      const finalPx = liveWidths.some((w: any) => Number.isFinite(w) && w > 0)
        ? liveWidths
        : measureColumnElementsPx(grid);
      const widths = widthsPxToGridPercents(finalPx, grid);
      options.onColumnsWidthsChange?.(columnsEl, widths);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
