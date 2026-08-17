# `@docengine/field-date`

Reference **DocEngine field plugin** for the `date` field type.

Date is **not** built into `@docengine/editor`. Hosts must install this package and register it — that is intentional, so this package stays the clear example for writing field plugins.

## Install

```bash
npm install @docengine/field-date @docengine/editor
```

This package ships compiled ESM from `dist/` (TypeScript source in `src/`).

## Required host setup

```js
import { registerField, createEditor } from '@docengine/editor';
import {
  dateFieldHandler,
  registerDateField,
  createDatePickerCallbacks,
} from '@docengine/field-date';

registerDateField({ registerField });
// or: registerField(dateFieldHandler);

createEditor({
  holder: document.getElementById('editor'),
  pickers: createDatePickerCallbacks(),
});
```

| Without this | Result |
|--------------|--------|
| No `registerDateField` | Date missing from palette / type dropdown |
| No `pickers.openDatePicker` | Fill-mode date tokens won't open a picker |

## What the plugin provides

| Export | Role |
|--------|------|
| `dateFieldHandler` | Full `FieldHandler` (`type: 'date'`) |
| `registerDateField({ registerField })` | Registers the handler |
| `createDateModal()` | Fill-mode `<input type="date">` modal (uses `@docengine/editor/ui/field-form-modal`) |
| `createDatePickerCallbacks()` | `{ openDatePicker }` for `createEditor({ pickers })` |

Handler capabilities:

- `createSchema` / `resolveDefaultValue` (`today` or fixed ISO date)
- `renderSchemaFields` / `readSchemaFields` (designer defaults UI)
- `formatDisplay` / `isEmpty` / `pdfRenderMode: 'plain'`
- `toDisplayConfig` / `toPickerConfig` (`picker: 'date'`)

## Copy this pattern for a new field

1. Create a package that exports a `FieldHandler` object (no side-effect registration on import).
2. Accept `{ registerField }` in a `registerXField` helper.
3. Optionally ship a modal and `createXPickerCallbacks()`.
4. Document which existing picker kind you reuse (`text`, `integer`, `date`, `list`, …) or provide a custom `pickers.*` callback.

See `@docengine/editor` SPEC §14.1–14.2 for the full handler contract.
