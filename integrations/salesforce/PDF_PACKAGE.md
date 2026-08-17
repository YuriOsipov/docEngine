# DocEngine PDF package (option 2B)

Optional companion to **DocEngine**. Owns the callout to **your** HTTPS PDF host. Core DocEngine stays editor + data only.

**Recommended host:** n8n workflow with `n8n-nodes-docengine` (Webhook → DocEngine → Respond PDF binary).

Also compatible: `apps/pdf-service` (`POST /pdf/generate`).

docengine-web API links (`/api/v1/render/*`) are for web/client JSON payloads — not the Salesforce Named Credential path.

See [PDF.md](./PDF.md) § Bring your own PDF server.

## Packages

| Package | Path | Role |
|---|---|---|
| **DocEngine** | `apps/salesforce/force-app/` | Templates, fill, merge, `DocEnginePdfController` facade |
| **DocEngine_PDF** | `apps/salesforce/force-app-pdf/` | `DocEnginePdfCallout` (Callable), Named Credential, Remote Site |

Link: core discovers `DocEnginePdfCallout` via `Type.forName` + `System.Callable` — no compile-time Apex dependency from LWC onto the PDF package.

## Dev deploy (unmanaged, same org)

```bash
npm run build:sf
sf project deploy start --source-dir apps/salesforce/force-app --target-org DocEngineDev
sf project deploy start --source-dir apps/salesforce/force-app-pdf --target-org DocEngineDev
sf org assign permset --name DocEngine_Admin --target-org DocEngineDev
sf org assign permset --name DocEngine_PDF_User --target-org DocEngineDev
```

Then set **Named Credential → DocEngine_Pdf** endpoint to a real HTTPS pdf-service URL (not `pdf.example.com`).

```bash
npm run dev:pdf   # local service — expose via ngrok/Cloud Run for the sandbox
```

## Behaviour without PDF package / provider

- Default provider is **Salesforce** (`Blob.toPdf`) — PDF works without DocEngine_PDF
- If provider is **External** and `DocEnginePdfCallout` is absent: `isAvailable()` → `false`
- Preview / Save + PDF follow the active provider

## Switch provider

Setup → Custom Settings → **DocEngine Settings** → Manage → New (Organization Level Default) → **Use External PDF**:

| Value | Effect |
|---|---|
| Unchecked (default) | In-org `Blob.toPdf` from editor HTML — no host |
| Checked | Named Credential `DocEngine_Pdf` → hosted pdf-service |

## Behaviour with PDF package + live URL

- Preview can use `generatePdfBase64` (when LWC passes `generatePdfBlob`)
- **Save + PDF** callouts → `callout:DocEngine_Pdf/pdf/generate` → Files on instance + source record

## 2GP (later)

`sfdx-project.json` already lists `DocEngine_PDF` with a dependency on `DocEngine`. After namespaces + package aliases exist:

```bash
sf package version create --package DocEngine --wait 30
sf package version create --package DocEngine_PDF --wait 30
```

Install order: DocEngine → DocEngine_PDF → configure Named Credential → assign `DocEngine_PDF_User`.

## Legacy path

`unpackaged/post-install/` previously held NC/RSS only. Prefer deploying `apps/salesforce/force-app-pdf` instead.
