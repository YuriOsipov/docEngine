export {
  registerField,
  unregisterField,
  getFieldHandler,
  hasFieldHandler,
  listFieldHandlers,
  getFieldTypes,
  getInlineFieldTypes,
  isInlineFieldType,
  clearFieldHandlers,
} from './registry.js';

export { registerBuiltinFields } from './builtins.js';

// Side-effect: register built-in field plugins on first import.
import './builtins.js';
