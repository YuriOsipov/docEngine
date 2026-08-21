# n8n-nodes-docengine

n8n community node: bind JSON values (or a source **payload** + template `fieldMapping`) to a DocEngine template and output **HTML** or **PDF**.

## Install

### n8n (self-hosted community node)

In n8n: **Settings → Community nodes → Install** and enter:

```text
n8n-nodes-docengine
```

Or from the n8n nodes directory:

```bash
npm install n8n-nodes-docengine
```

Unverified community nodes are available on self-hosted n8n only. See [n8n community node install docs](https://docs.n8n.io/integrations/community-nodes/installation-and-management/).

### From this monorepo

```bash
cd apps/n8n-nodes-docengine
npm install
npm run build
```

Link or copy into your n8n `custom` / community nodes folder per [n8n docs](https://docs.n8n.io/integrations/creating-nodes/deploy/install-community-nodes/).

## Salesforce / custom app → PDF

Salesforce **DocEngine_PDF** calls `POST /api/v1/render/pdf` (see [PDF.md](../../integrations/salesforce/PDF.md)).

Use this node when you want PDFs on **your** n8n host. The webhook path must match Apex (`/api/v1/render/pdf`) or change `GENERATE_PATH` in `DocEnginePdfCallout`.

Apex sends **template + values** only (`DocEnginePdfCallout.buildRenderBody`):

| Shape | Body | Handle with |
|-------|------|-------------|
| Template + values | `{ "template", "document" }` values-only (`kind: "field"`) | **DocEngine** node |

### Importable example (recommended)

See [`examples/`](./examples/) — workflow JSON, sample requests, and setup:

```text
Salesforce Named Credential
  → Webhook (POST /api/v1/render/pdf)
  → DocEngine
       Template Source: From incoming
       Template JSON Path: body.template
       Values JSON Path: body.document
       Output format: PDF
  → Respond to Webhook (binary PDF)
```

Import `examples/salesforce-render-pdf.workflow.json` in n8n, activate, point Named Credential `DocEngine_Pdf` at the n8n origin (no trailing slash).

### Payload + field mapping

If the template includes `fieldMapping` and the body has a Salesforce-style source object:

- Values JSON Path: `body.payload` (or leave empty if the item *is* the payload)
- Enable **Use Template Field Mapping**

## Node options

| Option | Meaning |
|--------|---------|
| Template Source | Stored in node, or from incoming item |
| Values JSON / Path | JSON object of field values (expressions / JS ok), a dot-path (`sections`), or empty for the whole item |
| Use Template Field Mapping | Run `applyFieldMapping` before bind |
| Output format | `html` or `pdf` |
| Hide empty values | Omit empty fields/rows |

When **Template Source** is Stored in Node, Values must be field values (or a `{ "sections": { … } }` map) — not a previous DocEngine PDF/document item. A JSON mapping in Values is used as-is; it is no longer mistaken for a path.

Output always includes full document JSON on the item plus a binary file property (default `data`).
