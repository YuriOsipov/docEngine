<script setup>

import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';

import Button from 'primevue/button';

import ToggleSwitch from 'primevue/toggleswitch';

import { useToast } from 'primevue/usetoast';

import { createEditor, registerField } from '@docengine/editor';
import {
  registerDateField,
  createDatePickerCallbacks,
} from '@docengine/field-date';
import '@docengine/editor/styles.css';
import '@docengine/editor/themes/bridge.css';
import '@docengine/editor/themes/prime.css';
import '../editor-theme.css';

registerDateField({ registerField });



const props = defineProps({

  template: { type: Object, default: null },

  /** Catalog data object ({ lists, trees }) for commonTreeId / commonListId resolution */

  catalogs: { type: Object, default: () => ({}) },

  /**

   * Async item search for remote-source list fields inside the editor.

   * Signature: ({ fieldName, schema, query, selected, fieldValues }) => Promise<item[]>

   */

  resolveListItems: { type: Function, default: null },

});



const toast = useToast();

const holderEl = ref(null);

const documentActionsEl = ref(null);

const designMode = ref(false);



let docEngine = null;



onMounted(async () => {
  await nextTick();
  docEngine = createEditor({

    holder: holderEl.value,

    catalogs: props.catalogs,

    resolveListItems: props.resolveListItems ?? undefined,

    pickers: createDatePickerCallbacks(),

    ui: {

      designLayout: 'panels',

      documentActionsContainer: documentActionsEl.value,

    },

  });



  if (props.template) {

    await docEngine.ready;

    await docEngine.load(props.template);

  }

});



onBeforeUnmount(() => {

  if (designMode.value) {

    document.body.classList.remove('design-mode', 'design-mode--panels');

  }

  docEngine?.destroy();

  docEngine = null;

});



watch(

  () => props.template,

  async (t) => {

    if (!docEngine || !t) return;

    await docEngine.ready;

    await docEngine.load(t);

  },

);



async function onDesignModeChange(enabled) {

  if (!docEngine) return;

  try {

    await docEngine.setDesignMode(!!enabled);

  } catch (err) {

    designMode.value = !enabled;

    toast.add({

      severity: 'error',

      summary: 'Design mode failed',

      detail: err.message,

      life: 4000,

    });

  }

}



async function exportPdf() {

  if (!docEngine) return;

  try {

    await docEngine.exportPdf({ filename: 'document.pdf' });

    toast.add({ severity: 'success', summary: 'PDF exported', life: 2500 });

  } catch (err) {

    toast.add({ severity: 'error', summary: 'PDF failed', detail: err.message, life: 4000 });

  }

}



async function exportFullDocument() {

  if (!docEngine) return;

  try {

    const docExport = await docEngine.exportDoc();

    const blob = new Blob([JSON.stringify(docExport, null, 2)], { type: 'application/json' });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;

    a.download = 'document.json';

    a.click();

    URL.revokeObjectURL(url);

    toast.add({ severity: 'success', summary: 'Exported', detail: 'document.json saved', life: 2500 });

  } catch (err) {

    toast.add({ severity: 'error', summary: 'Export failed', detail: err.message, life: 4000 });

  }

}



async function exportTemplate() {

  if (!docEngine) return;

  try {

    const templateExport = await docEngine.exportTemplate();

    const blob = new Blob([JSON.stringify(templateExport, null, 2)], { type: 'application/json' });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;

    a.download = 'template.json';

    a.click();

    URL.revokeObjectURL(url);

    toast.add({ severity: 'success', summary: 'Template exported', detail: 'template.json saved', life: 2500 });

  } catch (err) {

    toast.add({ severity: 'error', summary: 'Export failed', detail: err.message, life: 4000 });

  }

}

</script>



<template>

  <div class="editor-panel">

    <div class="editor-panel__toolbar">

      <label class="editor-panel__design-toggle">

        <ToggleSwitch v-model="designMode" @update:model-value="onDesignModeChange" />

        <span>Design mode</span>

      </label>



      <Button label="Export JSON" icon="pi pi-download" size="small" severity="secondary" @click="exportFullDocument" />

      <Button

        v-if="designMode"

        label="Export template"

        icon="pi pi-file-export"

        size="small"

        severity="secondary"

        @click="exportTemplate"

      />

      <Button label="Export PDF" icon="pi pi-file-pdf" size="small" severity="danger" @click="exportPdf" />



      <div ref="documentActionsEl" class="document-actions-host" />

    </div>



    <div

      ref="holderEl"

      class="editor-holder"

    />

  </div>

</template>



<style scoped>

.editor-panel {

  display: flex;

  flex-direction: column;

  flex: 1 1 auto;

  min-height: 0;

  overflow: hidden;

  gap: 12px;

  background: var(--p-content-background);

}



.editor-panel__toolbar {

  display: flex;

  align-items: center;

  gap: 12px;

  flex-wrap: wrap;

  flex-shrink: 0;

}



.editor-panel__design-toggle {

  display: inline-flex;

  align-items: center;

  gap: 8px;

  cursor: pointer;

  user-select: none;

}



.document-actions-host {

  margin-left: auto;

}



/* createEditor moves holder into .design-shell; shell becomes a flex sibling of the toolbar */
.editor-panel :deep(> .design-shell) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: var(--p-content-background);
}

.editor-panel :deep(> .design-shell--active) {
  overflow: hidden;
}

.editor-panel :deep(> .design-shell:not(.design-shell--active)) {
  display: flex;
  flex-direction: column;
}

.editor-panel :deep(.design-shell:not(.design-shell--active) .design-panel__toolbar) {
  flex-shrink: 0;
  background: var(--p-content-background);
}

.editor-panel :deep(.design-shell:not(.design-shell--active) .design-panel__editor-scroll) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}



.editor-panel :deep(.design-shell--active .design-panel--right) {

  display: flex;

  flex-direction: column;

  min-height: 0;

  overflow: hidden;

}



.editor-panel :deep(.properties-panel) {

  flex: 1 1 auto;

  min-height: 0;

  overflow: hidden;

}



.editor-panel :deep(.properties-panel__body) {

  flex: 1 1 auto;

  min-height: 0;

  overflow-y: auto;

  overflow-x: hidden;

  overscroll-behavior: contain;

}



.editor-holder {

  min-height: 0;

  border: 1px solid var(--p-surface-200);

  border-radius: 8px;

  overflow: hidden;

}



.document-actions-host:empty {

  display: none;

}

</style>


