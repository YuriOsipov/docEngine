# @docengine/engine

Headless document core: I/O, field schemas, mapping, formulas, and display utilities.

TypeScript is being introduced incrementally. Compiled ESM + declarations ship from `dist/`; source lives in `src/` (mixed `.ts` / `.js` during migration).

## Formula functions

Built-ins: `concat`, `age`, `sum`, `avg`, `min`, `max`, `count`. Hosts add or override names with `registerFormulaFunction` (templates store only the formula string). The same registry is used by n8n, PDF, and the editor — register before evaluate/render.

```js
import { registerFormulaFunction, evaluateFormula } from '@docengine/engine';

registerFormulaFunction({
  name: 'round',
  arity: 1,
  impl: ([value]) => Math.round(Number(value)),
});

evaluateFormula('round(1.6)', {}, {});
```
