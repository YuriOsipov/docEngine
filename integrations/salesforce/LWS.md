# Lightning Web Security (LWS) hardening — DocEngine

DocEngine’s editor runs inside `lwc:dom="manual"` mount points and loads from Static Resources (`DocEngineBundle` / `DocEngineCss`). Validate in a **scratch org with LWS enabled** before AppExchange review.

## Required host options (already set in LWCs)

| Option | Value | Why |
|---|---|---|
| `ui.designLayout` | `'chrome'` | Avoids `body.design-mode--panels`, which restyles the whole Lightning page |
| `ui.chromeParent` | Manual DOM node in the LWC | Keeps palette/toolbar inside the component |
| `ui.stickyChrome` | `false` | Host owns sticky behavior |

## Known global side effects

| Behavior | Location | LWS risk | Mitigation |
|---|---|---|---|
| `document.body.classList.toggle('design-mode')` | `design-mode.ts` | Medium — page-wide CSS | Use chrome layout only; retest design mode on a record page |
| `document.addEventListener('focusin')` | `create-editor.ts` | Low | Destroyed on `destroy()`; LWCs call destroy in `disconnectedCallback` |
| Modals appended to `document.body` | editor UI | Low–medium | SLDS adapter uses `z-index: 9001`; confirm modals appear above Lightning chrome |
| `loadScript` / `loadStyle` | `docEngineLib` | Low | Standard platform pattern |

## Scratch org checklist

1. Create scratch org with LWS on (default for recent API versions).
2. `npm run build:sf` → `sf project deploy start --source-dir apps/salesforce/force-app`.
3. Assign `DocEngine_Admin`.
4. Point Named Credential `DocEngine_Pdf` at a reachable pdf-service HTTPS URL.
5. **Builder:** open `docEngineTemplateBuilder` on a `DocEngine_Template__c` record — palette, field drop, field mapping modal, save.
6. **Filler:** open `docEngineFiller` on an Account (or matching object) — load template, merge, edit fields, Save, Save + PDF.
7. Confirm no Lightning page chrome breakage when design mode is on.
8. Confirm toast errors surface if PDF Named Credential is misconfigured.

## If `body.design-mode` conflicts

Short term: keep `designLayout: 'chrome'` (do not use `panels` on Lightning).

Longer term: migrate CSS from `body.design-mode …` to `.doc-editor-root.design-mode …` and toggle the class on the holder only (tracked as follow-up).

## PDF callout (P4)

- Client-side pdfmake is **not** in `DocEngineBundle` (5 MB Static Resource limit).
- PDF = Apex `DocEnginePdfController.generateAndSavePdf` → Named Credential `DocEngine_Pdf` → `POST /pdf/generate` → `ContentVersion` on instance + source record.
