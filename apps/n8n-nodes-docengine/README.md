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

**This node is the recommended way** for Salesforce and other apps to generate DocEngine PDFs on the user’s own infrastructure.

```text
Salesforce or custom app
  → Webhook (POST)
  → DocEngine
       Template Source: From incoming
       Template JSON Path: template
       Values JSON Path: document
       Output format: PDF
  → Respond to Webhook (binary PDF)
```

Salesforce `DocEnginePdfCallout` posts `{ "template", "document" }` to Named Credential `DocEngine_Pdf`. Point that credential at this webhook HTTPS URL.

docengine-web **API link** tokens (`/api/v1/render/*`) are a separate web/client flow — not what Salesforce should call.

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
