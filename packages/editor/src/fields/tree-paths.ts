/**
 * Build a space-joined path label from ancestor labels + current node.
 */
export function buildPath(ancestors: any, node: any) {
  return [...ancestors, node.label].join(' ');
}
