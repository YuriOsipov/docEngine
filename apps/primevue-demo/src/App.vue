<script setup>
import { ref, computed } from 'vue';
import Toolbar from 'primevue/toolbar';
import Button from 'primevue/button';
import Toast from 'primevue/toast';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { usePreset } from '@primeuix/themes';

import EditorPanel from './components/EditorPanel.vue';
import { THEMES, DEFAULT_THEME } from './themes.js';

// Load the bundled mammology template as default
import defaultTemplate from '../../../examples/mammology-document-template.json';
// Ophthalmology catalogs for templates that use commonTreeId / commonListId
import { ophthalmologyCatalogs } from '../../ophthalmology-demo/src/catalogs.js';
import { resolveOphthalmologyListItems } from '../../ophthalmology-demo/src/services/resolve-list-items.js';

const toast = useToast();
const template = ref(defaultTemplate);

/**
 * Detect whether the loaded template references external catalogs and supply
 * the matching catalog data. Ophthalmology catalogs cover all known commonTreeId
 * and commonListId values; mammology templates embed data inline so {} is fine.
 */
const activeCatalogs = computed(() => {
  const schemas = Object.values(template.value?.fieldSchemas ?? {});
  const needsCatalog = schemas.some((s) => s.commonTreeId || s.commonListId);
  return needsCatalog ? ophthalmologyCatalogs : {};
});

// Key changes when the catalog set switches so EditorPanel fully remounts
// (avoiding a race between the template watcher and a catalogs watcher).
const editorCatalogKey = computed(() =>
  activeCatalogs.value === ophthalmologyCatalogs ? 'ophthalmology' : 'default',
);

function loadTemplateFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.kind !== 'template') {
        toast.add({ severity: 'warn', summary: 'Wrong file', detail: 'Expected a file with kind: "template"', life: 4000 });
        return;
      }
      template.value = parsed;
      toast.add({ severity: 'success', summary: 'Template loaded', detail: file.name, life: 2500 });
    } catch (err) {
      toast.add({ severity: 'error', summary: 'Load failed', detail: err.message, life: 4000 });
    }
  };
  input.click();
}

const templateTitle = computed(
  () => template.value?.pageSetup?.title ?? template.value?.blocks?.[0]?.data?.label ?? 'Document',
);

// ── Theme switcher ────────────────────────────────────────────────────────────
const selectedThemeId = ref(DEFAULT_THEME.id);

function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
  selectedThemeId.value = theme.id;
  usePreset(theme.preset);
  document.documentElement.classList.toggle('dark-mode', theme.dark);
}
</script>

<template>
  <Toast />

  <div class="app-shell surface-ground">
    <!-- ── Toolbar ───────────────────────────────────────────────────────── -->
    <Toolbar class="shadow-1 border-noround" style="padding: 0.5rem 1rem">
      <template #start>
        <span class="font-bold text-lg mr-4 text-primary">📄 Document Engine</span>
        <span class="text-500 text-sm">PrimeVue Demo</span>
      </template>
      <template #center>
        <span class="font-semibold">{{ templateTitle }}</span>
      </template>
      <template #end>
        <Select
          :model-value="selectedThemeId"
          :options="THEMES"
          option-label="label"
          option-value="id"
          size="small"
          class="mr-2"
          @update:model-value="applyTheme"
        />
        <Button
          label="Load template"
          icon="pi pi-folder-open"
          size="small"
          severity="secondary"
          @click="loadTemplateFile"
        />
      </template>
    </Toolbar>

    <!-- ── Full editor ──────────────────────────────────────────────────── -->
      <!-- :key forces a full remount when the catalog set changes -->
    <main class="app-main">
      <EditorPanel
        :key="editorCatalogKey"
        :template="template"
        :catalogs="activeCatalogs"
        :resolve-list-items="resolveOphthalmologyListItems"
      />
    </main>
  </div>
</template>

<style>
/* ── Native control theming: drives checkboxes, scrollbars, search inputs ────── */
:root { color-scheme: light; }
html.dark-mode { color-scheme: dark; }

/* ── Host page resets ────────────────────────────────────────────────────────── */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: var(--p-font-family);
  background: var(--p-content-background, var(--p-surface-ground, var(--p-surface-100)));
  color: var(--p-text-color);
}

html.dark-mode,
html.dark-mode body {
  background: var(--p-content-background);
}

#app {
  height: 100%;
}

/* App shell — PrimeFlex is not bundled, so layout is defined here explicitly */
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 1rem;
  background: var(--p-content-background);
}

body.design-mode--panels .app-shell {
  height: 100vh;
  overflow: hidden;
}

/* ── Document editor inside EditorPanel ────────────────────────────────────────── */
.editor-holder .codex-editor {
  height: 100%;
}

</style>
