# LWC integration reference

Reference files for embedding `@docengine/editor` on a Salesforce Lightning page.

These are **not** a deployable SFDX project — copy into your org's LWC, or use the SFDX tree under [`../../apps/salesforce/force-app/`](../../apps/salesforce/force-app/). Full architecture (objects, Apex, packaging): [`../salesforce/ARCHITECTURE.md`](../salesforce/ARCHITECTURE.md).

## Files

| File | Purpose |
|------|---------|
| `docEditor.html` | SLDS shell + manual DOM mount points |
| `docEditor.css` | Mirror `--lwc-*` tokens onto `.doc-editor-root` |
| `docEditor.js` | `loadStyle` / `loadScript` + `createEditor` init (JS — Salesforce LWC controllers are `.js`) |
| `doc-editor-contract.d.ts` | Freeze contract for `window.DocEditor` |

## Setup

1. **Build Salesforce Static Resources** (from repo root):

   ```bash
   npm run build:sf
   ```

   This produces an **IIFE** JS bundle (`window.DocEditor`, Editor.js inlined) and the LWC CSS bundle, then copies them into `apps/salesforce/force-app/main/default/staticresources/`.

2. **Static Resources** in Salesforce:

   | Name | Source |
   |------|--------|
   | `DocEngineCss` | `packages/editor/dist/editor-lwc.css` (also `apps/salesforce/force-app/.../DocEngineCss.resource`) |
   | `DocEngineBundle` | `packages/editor/dist/editor-lwc.js` (also `apps/salesforce/force-app/.../DocEngineBundle.resource`) |

   `createEditor` is exposed as `window.DocEditor.createEditor`.

   > Legacy names `DocEditorLwcCss` / `DocEditorBundle` in older snippets map to the same artifacts; prefer `DocEngine*` going forward.

3. **Create LWC** `docEditor` using the reference files (update `@salesforce/resourceUrl/...` imports to `DocEngineCss` / `DocEngineBundle` if needed).

4. **Add to Lightning page** via App Builder.

## Styling

- **Page chrome** → `lightning-card`, `lightning-button`, etc. (SLDS)
- **Editor UI** → Static Resource CSS (`editor-lwc.css`)
- **Token bridge** → component CSS maps `--lwc-*` from `:host` to `.doc-editor-root`

Use `designLayout: 'chrome'` on Lightning pages (avoid `panels` unless you accept `body.design-mode--panels` side effects).

See [SPECIFICATIONS.md §15.1.1](../packages/editor/SPECIFICATIONS.md) for full contract.
