# PDF service setup (Salesforce)

DocEngine on Lightning generates PDFs via the Node `pdf-service` (`apps/pdf-service`), not in the browser.

## Endpoint

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/health` | — | `{ ok: true }` |
| POST | `/pdf/generate` | See below | `application/pdf` |

### Request shapes

**A — Template + values (preferred for Save + PDF):**

```json
{
  "template": { "kind": "template", "blocks": [], "fieldSchemas": {} },
  "document": { "kind": "field", "sections": {} }
}
```

`generateAndSavePdf` loads `Document_JSON__c` (values) and pinned `Template_Version__c.Template_JSON__c` (structure).

**B — Self-contained full document JSON:**

```json
{ "doc": { "kind": "document", "time": 0, "fieldSchemas": {}, "blocks": [/* … */], "pageSetup": {} } }
```

Also accepts `document` with `blocks` (same shape as `doc`).

## Local run

```bash
npm run dev:pdf
# listens on http://localhost:3920
```

Salesforce cannot call `http://localhost` from a cloud org. Expose HTTPS (ngrok, Cloud Run, etc.), then update:

1. Named Credential `DocEngine_Pdf` → base URL (no trailing slash)
2. Remote Site Setting `DocEngine_Pdf_Host` → same host (optional if NC covers it)

## Apex

`DocEnginePdfController.generateAndSavePdf(docInstanceId, html)` routes by **DocEngine Settings → Use External PDF**:

- **Unchecked (Salesforce)** — `Blob.toPdf(html)` after LWC normalizes HTML (CSS columns → tables, fixed table layout)
- **Checked (External)** — callout to `callout:DocEngine_Pdf/pdf/generate`, then `DocEngineInstanceController.savePdfFromBlob`

LWC: **Save + PDF** on `docEngineFiller`.

Switch: Setup → Custom Settings → DocEngine Settings → **Use External PDF**.
