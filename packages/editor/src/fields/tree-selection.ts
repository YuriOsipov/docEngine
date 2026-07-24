import { buildPath } from './tree-paths.js';

/**
 * Collect all leaf paths from a tree where leaf ids are in selectedIds.
 */
export function collectSelectedPaths(tree: any, selectedIds: any, ancestors: any = []): any {
  const paths = [];

  for (const node of tree) {
    const isLeaf = !node.children || node.children.length === 0;

    if (isLeaf && selectedIds.has(node.id)) {
      paths.push(buildPath(ancestors, node));
    }

    if (node.children?.length) {
      paths.push(
        ...collectSelectedPaths(node.children, selectedIds, [...ancestors, node.label]),
      );
    }
  }

  return paths;
}

/**
 * Find leaf node ids whose path label matches one of the given paths.
 */
export function pathsToLeafIds(tree: any, paths: any, ancestors: any = []) {
  const ids = new Set();
  const pathSet = new Set(paths);

  for (const node of tree) {
    const isLeaf = !node.children || node.children.length === 0;

    if (isLeaf) {
      const path = buildPath(ancestors, node);
      if (pathSet.has(path)) {
        ids.add(node.id);
      }
    }

    if (node.children?.length) {
      const childIds = pathsToLeafIds(node.children, paths, [...ancestors, node.label]);
      childIds.forEach((id: any) => ids.add(id));
    }
  }

  return ids;
}
