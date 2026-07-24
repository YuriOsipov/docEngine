function countTreeNodes(nodes: any) {
  let count = 0;
  for (const node of nodes ?? []) {
    count += 1;
    if (node.children?.length) count += countTreeNodes(node.children);
  }
  return count;
}

/**
 * @param {{ lists?: Record<string, { id?: string, label?: string, items?: unknown[], withCode?: boolean }>, trees?: Record<string, { id?: string, label?: string, tree?: unknown[] }> }} catalogs
 */
export function createCatalogProvider(catalogs: any = {}) {
  const lists = catalogs.lists ?? {};
  const trees = catalogs.trees ?? {};

  function getList(id: any) {
    if (!id) return null;
    return lists[id] ?? null;
  }

  function getTree(id: any) {
    if (!id) return null;
    return trees[id] ?? null;
  }

  return {
    getList,
    getTree,

    listIds() {
      return {
        lists: Object.keys(lists),
        trees: Object.keys(trees),
      };
    },

    listCommonValueLists() {
      return Object.entries(lists).map(([id, entry]: [any, any]) => ({
        id: entry.id ?? id,
        label: entry.label ?? id,
        itemCount: entry.items?.length ?? 0,
        withCode: entry.withCode ?? false,
      }));
    },

    listCommonValueTrees() {
      return Object.entries(trees).map(([id, entry]: [any, any]) => ({
        id: entry.id ?? id,
        label: entry.label ?? id,
        nodeCount: countTreeNodes(entry.tree),
        rootLabels: (entry.tree ?? []).map((node: any) => node.label),
      }));
    },

    resolveSchemaItems(schema: any) {
      if (!schema) return [];
      if (schema.commonListId) {
        const list = getList(schema.commonListId);
        if (!list) {
          console.warn(`Unknown commonListId: ${schema.commonListId}`);
          return [];
        }
        return list.items ?? [];
      }
      return schema.items ?? [];
    },

    resolveSchemaWithCode(schema: any) {
      if (!schema) return false;
      if (schema.commonListId) {
        const list = getList(schema.commonListId);
        return list?.withCode ?? false;
      }
      return schema.withCode ?? false;
    },

    resolveSchemaTree(schema: any) {
      if (!schema) return [];
      if (schema.commonTreeId) {
        const entry = getTree(schema.commonTreeId);
        if (!entry) {
          console.warn(`Unknown commonTreeId: ${schema.commonTreeId}`);
          return [];
        }
        return entry.tree ?? [];
      }
      return schema.tree ?? [];
    },
  };
}
