/** Shared command-palette overlay class for field picker modals. */
export const FIELD_MODAL_OVERLAY_CLASS = 'modal-overlay modal-overlay--palette';

/** Footer hint shown next to the primary action. */
export const FIELD_MODAL_FOOTER_HINT_HTML =
  '<span class="modal__footer-hint" aria-hidden="true">Ctrl+Enter</span>';

/** Footer hint for tree/list pickers with keyboard navigation. */
export const FIELD_PICKER_FOOTER_HINT_HTML =
  '<span class="modal__footer-hint" aria-hidden="true">↑↓ Space · Ctrl+Enter</span>';

/** Footer hint for tree picker (includes expand/collapse). */
export const FIELD_TREE_PICKER_FOOTER_HINT_HTML =
  '<span class="modal__footer-hint" aria-hidden="true">↑↓←→ Space · Ctrl+Enter</span>';

/**
 * Apply selection with Ctrl/Cmd+Enter from anywhere inside the modal overlay.
 */
export function wireModalConfirmShortcut(overlay: Element | null, btnOk: Element | null) {
  if (!overlay || !btnOk) return;

  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || (!e.ctrlKey && !e.metaKey)) return;
    e.preventDefault();
    (btnOk as HTMLElement).click();
  });
}

/**
 * Prefer a host inside Salesforce LightningModal (or our .doc-shell) so field
 * overlays sit inside the platform focus trap. Body-level overlays lose focus
 * to the trap and can freeze the page if focus is force-reclaimed in a loop.
 */
export function resolveFieldModalParent(from?: Element | null): HTMLElement {
  if (!from || !(from instanceof Element)) return document.body;
  const host =
    from.closest('.doc-shell') ||
    from.closest('.slds-modal__content') ||
    from.closest('.slds-modal__container') ||
    from.closest('.slds-modal');
  if (host instanceof HTMLElement) return host;
  return document.body;
}

/**
 * Walk out of nested shadow roots (LWC) so closest() can see Lightning chrome.
 */
function walkOutOfShadow(from: Element): Element | null {
  let node: Node | null = from;
  while (node) {
    if (node instanceof Element) {
      const hit =
        node.closest('.slds-modal__container') ||
        node.closest('.slds-modal') ||
        node.closest('lightning-modal') ||
        node.closest('[role="dialog"]');
      if (hit) return hit;
    }
    const root = node.getRootNode?.();
    if (root instanceof ShadowRoot && root.host) {
      node = root.host;
      continue;
    }
    break;
  }
  return null;
}

/**
 * Prefer the Lightning modal shell (full dialog) over .doc-shell so Document
 * preview covers header/body/footer — not only the narrow page column.
 */
export function resolvePreviewModalParent(from?: Element | null): HTMLElement {
  if (!from || !(from instanceof Element)) return document.body;
  const host = walkOutOfShadow(from) || resolveFieldModalParent(from);
  if (host instanceof HTMLElement) return host;
  return document.body;
}

/** Append overlay under parent; mark contained when not on document.body. */
export function mountFieldModalOverlay(overlay: HTMLElement, parent?: HTMLElement | null) {
  const target = parent instanceof HTMLElement ? parent : document.body;
  if (target !== document.body) {
    overlay.classList.add('modal-overlay--contained');
    if (getComputedStyle(target).position === 'static') {
      target.style.position = 'relative';
    }
  } else {
    overlay.classList.remove('modal-overlay--contained');
  }
  if (overlay.parentElement !== target) {
    target.appendChild(overlay);
  }
}

export type FieldModalFocusOptions = {
  /** Select all text when focusing an input/textarea. */
  selectAll?: boolean;
};

/**
 * Deferred focus for field modal inputs.
 * Do NOT install a continuous focusin reclaim — that fights LightningModal's
 * focus trap and can hang the main thread ("Page Unresponsive").
 */
export function wireFieldModalFocus(
  overlay: HTMLElement,
  focusTarget: HTMLElement,
  options: FieldModalFocusOptions = {}
): () => void {
  let disposed = false;

  const applySelection = () => {
    if (disposed || overlay.hidden) return;
    const el = focusTarget as HTMLInputElement | HTMLTextAreaElement;
    if (typeof el.select === 'function' && options.selectAll) {
      try {
        el.select();
      } catch {
        /* some input types reject select() */
      }
      return;
    }
    if (typeof el.setSelectionRange === 'function' && 'value' in el) {
      const len = String(el.value ?? '').length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        /* number inputs etc. */
      }
    }
  };

  const claimFocus = () => {
    if (disposed || overlay.hidden) return;
    try {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        active !== focusTarget &&
        !overlay.contains(active) &&
        active.isContentEditable &&
        typeof active.blur === 'function'
      ) {
        active.blur();
      }
    } catch {
      /* ignore */
    }
    try {
      focusTarget.focus({ preventScroll: true });
    } catch {
      focusTarget.focus();
    }
    applySelection();
  };

  // Defer past the opening click so the field token doesn't steal focus back.
  requestAnimationFrame(() => {
    setTimeout(claimFocus, 0);
  });

  return () => {
    disposed = true;
  };
}
