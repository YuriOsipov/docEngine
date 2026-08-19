# n8n-nodes-docengine

n8n community node: bind JSON values (or a source **payload** + template `fieldMapping`) to a DocEngine template and output **HTML** or **PDF**.

## Install

From the DocEngine monorepo:

```bash
cd apps/n8n-nodes-docengine
npm install
npm run build
```

Link or copy into your n8n `custom` / community nodes folder per [n8n docs](https://docs.n8n.io/integrations/creating-nodes/deploy/install-community-nodes/).

## Salesforce / custom app → PDF

Salesforce **DocEngine_PDF** calls DocEngine.pro `POST /api/v1/render/pdf` (see [PDF.md](../../integrations/salesforce/PDF.md)).

Use this node when you want PDFs on **your** n8n host instead. The webhook path must match Apex (`/api/v1/render/pdf`) or you change `GENERATE_PATH` in `DocEnginePdfCallout`.

```text
Salesforce or custom app
  → Webhook (POST /api/v1/render/pdf)
  → DocEngine
       Template Source: From incoming
       Template JSON Path: template
       Values JSON Path: document
       Output format: PDF
  → Respond to Webhook (binary PDF)
```

Salesforce posts `{ "template", "document" }` or a full `{ "doc" }` with `blocks` + `pageSetup`.

### Payload + field mapping

If the template includes `fieldMapping` and the body has a Salesforce-style source object:

- Values JSON Path: `payload` (or leave empty if the item *is* the payload)
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
