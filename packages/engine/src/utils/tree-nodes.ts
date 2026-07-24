import type { TreeNode } from '../types.js';

/**
 * Tree nodes in templates are stored as { label, children? } without ids.
 * Ids are assigned dynamically at runtime for UI selection state.
 */

export function stripTreeNodeIds(nodes: TreeNode[] | null | undefined): TreeNode[] {
  return (nodes ?? [])
    .map((node) => {
      const label = String(node?.label ?? '').trim();
      if (!label) return null;
      const entry: TreeNode = { label };
      if (node.children?.length) {
        entry.children = stripTreeNodeIds(node.children as TreeNode[]);
      }
      return entry;
    })
    .filter((node): node is TreeNode => node != null);
}

export function stripTreeIdsFromFieldSchemas(
  fieldSchemas: Record<string, { type?: string; tree?: TreeNode[] } | null | undefined> | null | undefined,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [fieldId, schema] of Object.entries(fieldSchemas ?? {})) {
    if (schema?.type === 'tree' && Array.isArray(schema.tree)) {
      next[fieldId] = { ...schema, tree: stripTreeNodeIds(schema.tree) };
    } else {
      next[fieldId] = schema;
    }
  }
  return next;
}

function treeIdFromPath(ancestors: string[], label: string): string {
  const raw = [...ancestors, label].join('/').toLowerCase();
  const slug = raw
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug ? `n_${slug}` : `n_${ancestors.length}`;
}

export function ensureTreeNodeIds(
  nodes: TreeNode[] | null | undefined,
  ancestors: string[] = [],
): TreeNode[] {
  return (nodes ?? [])
    .map((node) => {
      const label = String(node?.label ?? '').trim();
      if (!label) return null;
      const id = node.id ?? treeIdFromPath(ancestors, label);
      const entry: TreeNode = { label, id };
      if (node.children?.length) {
        entry.children = ensureTreeNodeIds(node.children as TreeNode[], [...ancestors, label]);
      }
      return entry;
    })
    .filter((node): node is TreeNode => node != null);
}

export function ensureTreeIdsInFieldSchemas(
  fieldSchemas: Record<string, { type?: string; tree?: TreeNode[] } | null | undefined> | null | undefined,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [fieldId, schema] of Object.entries(fieldSchemas ?? {})) {
    if (schema?.type === 'tree' && Array.isArray(schema.tree)) {
      next[fieldId] = { ...schema, tree: ensureTreeNodeIds(schema.tree) };
    } else {
      next[fieldId] = schema;
    }
  }
  return next;
}

/** Normalize template field schemas: strip stored ids, ready for export/storage. */
export function normalizeTemplateFieldSchemas(
  fieldSchemas: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return stripTreeIdsFromFieldSchemas(
    fieldSchemas as Record<string, { type?: string; tree?: TreeNode[] }>,
  );
}
