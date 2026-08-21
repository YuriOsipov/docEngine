# PDF service setup (Salesforce)

DocEngine on Lightning generates PDFs via **DocEngine.pro** `POST /api/v1/render/pdf` (or a compatible host), not in the browser.

## Endpoint

Named Credential `DocEngine_Pdf` = site origin with **no trailing slash**. Apex appends `/api/v1/render/pdf`.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/v1/render/pdf` | See below | `application/pdf` |

Auth: Named Credential **Password** protocol. Username can be `api`; **password** is a DocEngine.pro API token (`de_…`) with `render` (and `pdf`) scope. The host accepts Bearer, `X-Api-Key`, or HTTP Basic (password = token).

### Request shape

External PDF / n8n accepts **template + values** only:

```json
{
  "template": { "kind": "template", "blocks": [], "fieldSchemas": {}, "pageSetup": {} },
  "document": { "kind": "field", "sections": {} }
}
```

`generateAndSavePdf` loads `Document_JSON__c` (values) and pinned `Template_Version__c.Template_JSON__c` (structure).

Preview **View as PDF** with External PDF also sends this shape: LWC collapses the filled editor doc to values and Apex posts `template` + `document` only (no `doc` snapshot).

## Subscriber setup

1. Install **DocEngine** then **DocEngine_PDF**. Assign `DocEngine_Admin` and `DocEngine_PDF_User`.
2. On DocEngine.pro: Dashboard → create an API token (`render` + `pdf` scopes; template binding optional).
3. Setup → Named Credentials → **DocEngine PDF**:
   - URL: `https://docengine.pro` (no trailing slash)
   - Username: `api`
   - Password: the `de_…` token
4. Setup → Custom Settings → **DocEngine Settings** → **Use External PDF** = checked.

Salesforce cannot call `http://localhost`. For local pdf-service, expose HTTPS (ngrok) and point the Named Credential at that origin (`POST /api/v1/render/pdf` is aliased).

## Apex

`DocEnginePdfController.generateAndSavePdf(docInstanceId, html)` routes by **DocEngine Settings → Use External PDF**:

- **Unchecked (Salesforce)** — `Blob.toPdf(html)` after LWC normalizes HTML (CSS columns → tables, fixed table layout)
- **Checked (External)** — callout to `callout:DocEngine_Pdf/api/v1/render/pdf`, then `DocEngineInstanceController.savePdfFromBlob`

LWC: **Save + PDF** on `docEngineFiller`. Preview **View as PDF** (External) sends **template + values** only; Salesforce provider still uses HTML → `Blob.toPdf`.

## Alternative hosts

- **`apps/pdf-service`** — same JSON bodies; `POST /api/v1/render/pdf` and legacy `POST /pdf/generate`.
- **n8n + `n8n-nodes-docengine`** — webhook must expose `POST /api/v1/render/pdf` (or change `GENERATE_PATH` in `DocEnginePdfCallout`).
