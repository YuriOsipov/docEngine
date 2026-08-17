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

## Bring your own PDF server

External PDF runs on **your** HTTPS host. Configure Named Credential `DocEngine_Pdf` → that base URL (no trailing slash). Prefer Named Credential auth when the host requires a secret.

### Recommended — n8n + `n8n-nodes-docengine`

Salesforce (and other custom apps) should generate PDFs through an **n8n** workflow using the DocEngine node — not through docengine-web API link tokens.

1. Install `n8n-nodes-docengine` (`apps/n8n-nodes-docengine`).
2. Build a workflow:

```text
Webhook (POST)
  → DocEngine
       Template Source: From incoming → path `template`
       Values JSON Path: `document`
       (or Values = `payload` + enable **Use Template Field Mapping**)
       Output format: PDF
  → Respond to Webhook
       Respond With: Binary → PDF
```

3. Point Named Credential `DocEngine_Pdf` at the webhook HTTPS URL (match path vs `GENERATE_PATH` `/pdf/generate` — either put `/pdf/generate` on the webhook path or adjust the callout/host).
4. Optional: after DocEngine, add Slack / Drive / email — Salesforce only needs the PDF bytes back.

**Salesforce body (unchanged):** `DocEnginePdfCallout` posts `{ template, document }` (or self-contained `document` with blocks). Map those paths in the DocEngine node.

**Auth:** protect the webhook (header / Basic) and store the secret on the Named Credential.

See [n8n-nodes-docengine README](../../apps/n8n-nodes-docengine/README.md).

### Alternative — `apps/pdf-service`

Minimal Node host wrapping `@docengine/pdf-renderer` (`POST /pdf/generate`). See **Local run** above. Use when you want a dedicated renderer without n8n.
