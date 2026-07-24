/**
 * Document-level undo/redo stack for createEditor.
 * Snapshots are deep-cloned JSON documents (blocks, schemas, pageSetup, …).
 */

export type DocumentHistorySnapshot = Record<string, any>;

export type DocumentHistoryOptions = {
  maxDepth?: number;
};

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

export function cloneHistorySnapshot(doc: DocumentHistorySnapshot | null | undefined): DocumentHistorySnapshot {
  return JSON.parse(JSON.stringify(doc ?? {}));
}

export function createDocumentHistory(options: DocumentHistoryOptions = {}) {
  const maxDepth = Math.max(1, options.maxDepth ?? 50);
  let past: string[] = [];
  let present: string | null = null;
  let future: string[] = [];
  let suspended = 0;

  function isSuspended() {
    return suspended > 0;
  }

  function suspend() {
    suspended += 1;
    return () => {
      suspended = Math.max(0, suspended - 1);
    };
  }

  function hasPresent() {
    return present != null;
  }

  function getPresent(): DocumentHistorySnapshot | null {
    return present == null ? null : JSON.parse(present);
  }

  function reset(snapshot: DocumentHistorySnapshot) {
    past = [];
    future = [];
    present = stableStringify(cloneHistorySnapshot(snapshot));
  }

  function record(snapshot: DocumentHistorySnapshot) {
    if (isSuspended()) return false;
    const next = stableStringify(cloneHistorySnapshot(snapshot));
    if (present != null && present === next) return false;
    if (present != null) {
      past.push(present);
      if (past.length > maxDepth) past.shift();
    }
    present = next;
    future = [];
    return true;
  }

  function canUndo() {
    return past.length > 0;
  }

  function canRedo() {
    return future.length > 0;
  }

  function undo(): DocumentHistorySnapshot | null {
    if (!canUndo() || present == null) return null;
    future.push(present);
    present = past.pop() ?? null;
    return getPresent();
  }

  function redo(): DocumentHistorySnapshot | null {
    if (!canRedo() || present == null) return null;
    past.push(present);
    if (past.length > maxDepth) past.shift();
    present = future.pop() ?? null;
    return getPresent();
  }

  return {
    reset,
    record,
    undo,
    redo,
    canUndo,
    canRedo,
    hasPresent,
    getPresent,
    suspend,
    isSuspended,
  };
}

export type DocumentHistory = ReturnType<typeof createDocumentHistory>;
