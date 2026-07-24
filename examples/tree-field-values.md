# Tree field values — examples

Tree fields (`complaints`, `lifeAnamnesis`) store **arrays of full path strings**.
Each path is built from the tree root to the selected **leaf**, labels joined with spaces.

## How paths are built

Tree in [`ophthalmology-complaints-tree.js`](../src/data/ophthalmology-complaints-tree.js):

```
Vision disturbance
  ├── blurring
  ├── decreased acuity    →  "Vision disturbance decreased acuity"
  └── diplopia            →  "Vision disturbance diplopia"
Tearing                   →  "Tearing"  (leaf at root)
Discharge
  ├── mucous              →  "Discharge mucous"
  └── purulent            →  "Discharge purulent"
```

## Example `fieldValues` in saved JSON

```json
{
  "fieldValues": {
    "complaints": [
      "Vision disturbance decreased acuity",
      "Tearing",
      "Redness"
    ],
    "lifeAnamnesis": [
      "Chronic conditions diabetes mellitus",
      "Allergy seasonal",
      "Unremarkable"
    ]
  }
}
```

## On screen

Multiple selections are shown inline, separated by `; `:

- **Complaints:** `Vision disturbance decreased acuity; Tearing; Redness`
- **Life history:** `Chronic conditions diabetes mellitus; Unremarkable`

## Load a full example

Use **Load** in the app and open [`ophthalmology-document-example.json`](./ophthalmology-document-example.json).

## Register a new tree field

1. Add tree data in `src/data/*.js`
2. Register in `src/data/field-registry.js`:

```javascript
myField: treeField('My label', myTreeData),
```

3. Add a segment in `ophthalmology-template.js`:

```javascript
{ type: 'field', id: 'myField', placeholder: 'Select...' },
```

4. Optional default in `fieldValues`:

```javascript
fieldValues: {
  myField: ['Branch sub-branch leaf'],
}
```
