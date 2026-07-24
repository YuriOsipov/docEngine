// @ts-nocheck
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ensureTreeNodeIds,
  stripTreeNodeIds,
  stripTreeIdsFromFieldSchemas,
} from './tree-nodes.js';

test('stripTreeNodeIds removes ids from tree nodes', () => {
  const stripped = stripTreeNodeIds([
    {
      id: 'n_ma7tr1',
      label: 'Parent',
      children: [{ id: 'n_gv5x6g', label: 'Child' }],
    },
  ]);
  assert.deepEqual(stripped, [{ label: 'Parent', children: [{ label: 'Child' }] }]);
});

test('ensureTreeNodeIds assigns deterministic ids from labels', () => {
  const tree = ensureTreeNodeIds([{ label: 'Parent', children: [{ label: 'Child' }] }]);
  assert.equal(tree[0].id, 'n_parent');
  assert.equal(tree[0].children[0].id, 'n_parent_child');
});

test('stripTreeIdsFromFieldSchemas cleans tree field schemas', () => {
  const schemas = stripTreeIdsFromFieldSchemas({
    status: {
      type: 'tree',
      label: 'Status',
      tree: [{ id: 'n_1', label: 'OK' }],
    },
    name: { type: 'text', label: 'Name' },
  });
  assert.deepEqual(schemas.status.tree, [{ label: 'OK' }]);
  assert.equal(schemas.name.type, 'text');
});
