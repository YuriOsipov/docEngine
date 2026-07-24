/**
 * Re-export tree id helpers from @docengine/engine (single source of truth).
 */
export {
  ensureTreeNodeIds as ensureTreeIds,
  stripTreeNodeIds,
} from '@docengine/engine';

export { buildPath } from './tree-paths.js';

export { collectSelectedPaths, pathsToLeafIds } from './tree-selection.js';
