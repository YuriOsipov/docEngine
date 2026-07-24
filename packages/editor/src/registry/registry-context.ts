const REGISTRY_KEY = Symbol('docEditorRegistry');

export function attachRegistryToHolder(holder: any,registry: any) {
  holder.dataset.docEditor = '1';
  holder[REGISTRY_KEY] = registry;
}

export function detachRegistryFromHolder(holder: any) {
  delete holder[REGISTRY_KEY];
  delete holder.dataset.docEditor;
}

export function getRegistryFromNode(node: any) {
  if (!node) return null;
  const holder = node.closest?.('[data-doc-editor]');
  return holder?.[REGISTRY_KEY] ?? null;
}

export function getRegistryFromConfig(config: any) {
  if (typeof config?.getRegistry === 'function') return config.getRegistry();
  const fromConfig = config?.registry;
  if (fromConfig?.getFieldDef) return fromConfig;
  if (config?.editorHolder?.[REGISTRY_KEY]) return config.editorHolder[REGISTRY_KEY];
  return getRegistryFromNode(config?.editorHolder);
}

export function resolveRegistry(nodeOrOptions: any) {
  if (typeof nodeOrOptions?.getRegistry === 'function') {
    return nodeOrOptions.getRegistry();
  }
  const fromConfig = nodeOrOptions?.registry;
  if (fromConfig?.getFieldDef) return fromConfig;
  if (nodeOrOptions?.editorHolder?.[REGISTRY_KEY]) return nodeOrOptions.editorHolder[REGISTRY_KEY];
  if (nodeOrOptions?.holder?.[REGISTRY_KEY]) return nodeOrOptions.holder[REGISTRY_KEY];
  return getRegistryFromNode(nodeOrOptions);
}
