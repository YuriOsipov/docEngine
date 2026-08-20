# Salesforce PDF webhook examples

Importable n8n workflow and sample bodies matching `DocEnginePdfCallout`
(`POST /api/v1/render/pdf` → raw PDF bytes).

## Files

| File | Purpose |
|------|---------|
| [`salesforce-render-pdf.workflow.json`](./salesforce-render-pdf.workflow.json) | Full flow: Webhook → IF → DocEngine **or** host render → Respond PDF |
| [`sf-request-values.json`](./sf-request-values.json) | SF Save + PDF shape: `template` + values `document` |
| [`sf-request-full-doc.json`](./sf-request-full-doc.json) | SF preview / filled shape: `doc` + `document` with `blocks` |

## Flow

```text
Salesforce Named Credential DocEngine_Pdf
  → POST {n8n}/webhook/api/v1/render/pdf
       → IF document has blocks?
            YES → HTTP Request → docengine-web (or pdf-service) /api/v1/render/pdf
            NO  → DocEngine node (template + document → PDF)
       → Respond to Webhook (binary application/pdf)
```

## Setup

1. Build and install `n8n-nodes-docengine` (see parent README).
2. In n8n: **Workflows → Import from File** → `salesforce-render-pdf.workflow.json`.
3. Set environment variables on the n8n host (full-doc branch only):

   | Variable | Example |
   |----------|---------|
   | `DOCENGINE_PDF_BASE_URL` | `https://your-docengine-web` or `http://localhost:4100` |
   | `DOCENGINE_API_TOKEN` | `de_…` with `render` + `pdf` scopes |

4. Activate the workflow. Production URL:

   `https://<n8n-host>/webhook/api/v1/render/pdf`

5. Salesforce Named Credential **DocEngine_Pdf**:
   - URL = `https://<n8n-host>` (no trailing slash, no path)
   - Password = optional shared secret if you add Webhook auth
   - Custom Setting **Use External PDF** = checked

## Manual test

```bash
# Values-only (DocEngine node branch)
curl -X POST "http://localhost:5678/webhook-test/api/v1/render/pdf" \
  -H "Content-Type: application/json" \
  -d @sf-request-values.json \
  --output values.pdf

# Full document with blocks (host render branch)
curl -X POST "http://localhost:5678/webhook-test/api/v1/render/pdf" \
  -H "Content-Type: application/json" \
  -d @sf-request-full-doc.json \
  --output full.pdf
```

Use **Listen for test event** on the Webhook node for `/webhook-test/…`, or activate the workflow for `/webhook/…`.

## Salesforce body contract

Built by Apex `DocEnginePdfCallout.buildRenderBody`:

- **Has `blocks`** → `{ doc, document, pageSetup?, template? }`
- **Values-only** → `{ document, template }`

Success response must be HTTP 2xx with a non-empty PDF body (not JSON/base64).
