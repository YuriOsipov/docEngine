# Salesforce PDF webhook examples

Importable n8n workflow and sample bodies matching `DocEnginePdfCallout`
(`POST /api/v1/render/pdf` → raw PDF bytes).

## Files

| File | Purpose |
|------|---------|
| [`salesforce-render-pdf.workflow.json`](./salesforce-render-pdf.workflow.json) | Webhook → DocEngine (template + values) → Respond PDF |
| [`sf-request-values.json`](./sf-request-values.json) | SF External PDF shape: `template` + values `document` |

## Flow

```text
Salesforce Named Credential DocEngine_Pdf
  → POST {n8n}/webhook/api/v1/render/pdf
       → DocEngine (body.template + body.document → PDF)
       → Respond to Webhook (binary application/pdf)
```

## Setup

1. Build and install `n8n-nodes-docengine` (see parent README).
2. In n8n: **Workflows → Import from File** → `salesforce-render-pdf.workflow.json`.
3. Activate the workflow. Production URL:

   `https://<n8n-host>/webhook/api/v1/render/pdf`

4. Salesforce Named Credential **DocEngine_Pdf**:
   - URL = `https://<n8n-host>` (no trailing slash, no path)
   - Password = optional shared secret if you add Webhook auth
   - Custom Setting **Use External PDF** = checked

## Manual test

```bash
curl -X POST "http://localhost:5678/webhook-test/api/v1/render/pdf" \
  -H "Content-Type: application/json" \
  -d @sf-request-values.json \
  --output values.pdf
```

Use **Listen for test event** on the Webhook node for `/webhook-test/…`, or activate the workflow for `/webhook/…`.

## Salesforce body contract

Built by Apex `DocEnginePdfCallout.buildRenderBody`:

- **Required:** `{ template, document }` (values-only preferred; no `doc` snapshot)

Success response must be HTTP 2xx with a non-empty PDF body (not JSON/base64).
