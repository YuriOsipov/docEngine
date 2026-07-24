import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDocumentHistory } from './document-history.js';

describe('createDocumentHistory', () => {
  it('records snapshots and undoes to the previous state', () => {
    const history = createDocumentHistory();
    history.reset({ blocks: [{ id: 'a' }] });
    history.record({ blocks: [{ id: 'b' }] });
    history.record({ blocks: [{ id: 'c' }] });

    assert.equal(history.canUndo(), true);
    assert.deepEqual(history.undo(), { blocks: [{ id: 'b' }] });
    assert.deepEqual(history.undo(), { blocks: [{ id: 'a' }] });
    assert.equal(history.canUndo(), false);
  });

  it('redoes after undo and clears redo on new edits', () => {
    const history = createDocumentHistory();
    history.reset({ v: 1 });
    history.record({ v: 2 });
    history.record({ v: 3 });
    history.undo();
    assert.deepEqual(history.redo(), { v: 3 });

    history.undo();
    history.record({ v: 4 });
    assert.equal(history.canRedo(), false);
    assert.deepEqual(history.getPresent(), { v: 4 });
  });

  it('ignores identical snapshots and respects suspend', () => {
    const history = createDocumentHistory();
    history.reset({ v: 1 });
    assert.equal(history.record({ v: 1 }), false);

    const resume = history.suspend();
    assert.equal(history.record({ v: 2 }), false);
    resume();
    assert.equal(history.record({ v: 2 }), true);
  });

  it('caps undo depth', () => {
    const history = createDocumentHistory({ maxDepth: 2 });
    history.reset({ v: 0 });
    history.record({ v: 1 });
    history.record({ v: 2 });
    history.record({ v: 3 });

    assert.deepEqual(history.undo(), { v: 2 });
    assert.deepEqual(history.undo(), { v: 1 });
    assert.equal(history.canUndo(), false);
  });
});
