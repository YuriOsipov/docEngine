# Template list UX

| Step | DocEngine |
|---|---|
| List templates | Standard list on **DocEngine Templates** (`DocEngine_Template__c`) |
| Columns | Name, **Source Object**, Active, Version, PDF Filename, Last Modified |
| Create | Quick Action **New Template** → `docEngineTemplateNew` |
| Fields | Template Name, Description, Data Source |
| Editor | **DocEngine Editor** on the template record → `docEngineTemplateBuilder` |

## After deploy

1. Open the **DocEngine Templates** tab (or DocEngine app).
2. Switch list view to **All Templates** (or **Active Templates**).
3. Click **New Template** (list view action). Fill name, description, data source → **Create**.

   If the button is missing after deploy: **Object Manager → DocEngine Template → Buttons, Links, and Actions** (or **List View Button Layout**) → add the **New Template** Lightning action. `listViewButtons` in object metadata cannot reference LWC Quick Actions (only classic WebLinks).
4. You land on the template record page — **DocEngine Template Record Page** (single-column FlexiPage) shows the builder full-width. Assigned for the DocEngine app (Admin). If you still see a narrow layout: gear → **Edit Page** → Activation → **Assign as Org Default**.

Optional: hide the default Salesforce **New** button in the list view layout if you only want the custom create modal.

## Components

- `docEngineTemplateNew` — create modal / screen action  
- `docEngineTemplateBuilder` — design editor on the record page  
- `DocEngineObjectDescribeController.listSourceObjects` — Data Source combobox  

## Field mapping (design → fill)

1. Set **Source Object** on the template.  
2. Open **Field mapping** — builder loads a describe-based **sample JSON** (same field paths as `DocEngineMergeController.buildPayload`).  
3. Drag source paths onto template fields; **Save** stores `fieldMapping` inside `Template_JSON__c`.  
4. Fill mode: `buildPayload` → `applyFieldMapping` using the embedded mapping.

## Remote lists (choice / list fields)

In the field designer, set **List source → Remote search**, then pick a collection:

| Collection id | Behavior |
|---|---|
| `Account` (Source Object) | Search records by Name |
| `Account.Industry` | Picklist values for that field |

Runtime uses `schema.sourceCollection` via `DocEngineListController.resolveListItems`.
