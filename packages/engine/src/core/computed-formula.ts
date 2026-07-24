import {
  extractFormulaReferences,
  extractFormulaDependencyFieldIds,
  resolveFormulaReference,
} from './formula-field-index.js';
import type { EditorBlock, FieldSchema } from '../types.js';

export { extractFormulaDependencyFieldIds } from './formula-field-index.js';

type FieldSchemaMap = Record<string, FieldSchema>;
type ValueMap = Record<string, unknown>;

type Token =
  | { type: 'FIELD'; value: string }
  | { type: 'STRING'; value: string }
  | { type: 'NUMBER'; value: number }
  | { type: 'IDENT'; value: string }
  | { type: 'OP'; value: string }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' }
  | { type: 'COMMA' }
  | { type: 'EOF' };

type FormulaResult = { value: string; error: string | null };

type EvaluateOptions = {
  evaluating?: Iterable<string>;
  selfId?: string;
  blocks?: EditorBlock[];
};

/** Raw reference strings inside `{…}` braces (field IDs or dot paths). */
export function extractFormulaDependencies(formula: string): string[] {
  return extractFormulaReferences(formula);
}

export function detectCircularDependency(
  fieldId: string,
  formula: string,
  fieldSchemas: FieldSchemaMap,
  blocks: EditorBlock[] = [],
): boolean {
  if (!fieldId || !formula) return false;

  const depIds = extractFormulaDependencyFieldIds(formula, blocks, fieldSchemas);
  if (depIds.includes(fieldId)) return true;

  const processingFieldIds = new Set([fieldId]);
  function hasCycle(depId: string): boolean {
    if (processingFieldIds.has(depId)) return true;
    const schema = fieldSchemas?.[depId];
    if (schema?.type !== 'computed') return false;
    processingFieldIds.add(depId);
    const nested = extractFormulaDependencyFieldIds(
      (schema.formula as string | undefined) ?? '',
      blocks,
      fieldSchemas,
    );
    const cyclic = nested.some(hasCycle);
    processingFieldIds.delete(depId);
    return cyclic;
  }

  return depIds.some(hasCycle);
}

function scalarizeRawValue(value: unknown): unknown {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.join('; ');
  if (typeof value === 'object') return '';
  return value;
}

function isNumericValue(value: unknown): boolean {
  if (value === '' || value == null) return false;
  if (typeof value === 'number' && !Number.isNaN(value)) return true;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return true;
  return false;
}

function toNumber(value: unknown): number {
  if (value === '' || value == null) throw new Error('Expected number');
  const num = Number(value);
  if (Number.isNaN(num)) throw new Error('Expected number');
  return num;
}

function formatResult(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  }
  return String(value);
}

function ageFromIsoDate(value: unknown): number | string {
  const str = String(value ?? '').trim();
  if (!str) return '';
  const date = new Date(`${str}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date for age()');
  const today = new Date();
  let years = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    years -= 1;
  }
  return years;
}

function resolveScalarFieldValue(
  fieldId: string,
  values: ValueMap,
  fieldSchemas: FieldSchemaMap,
  evaluating: Set<string>,
  blocks: EditorBlock[],
): unknown {
  if (evaluating.has(fieldId)) {
    throw new Error('Circular reference');
  }

  const schema = fieldSchemas?.[fieldId];
  if (schema?.type === 'computed') {
    evaluating.add(fieldId);
    try {
      const { value, error } = evaluateFormulaInternal(
        (schema.formula as string | undefined) ?? '',
        values,
        fieldSchemas,
        evaluating,
        blocks,
      );
      if (error) throw new Error(error);
      return scalarizeRawValue(value);
    } finally {
      evaluating.delete(fieldId);
    }
  }

  return scalarizeRawValue(values?.[fieldId]);
}

function resolveReferenceValues(
  ref: string,
  values: ValueMap,
  fieldSchemas: FieldSchemaMap,
  evaluating: Set<string>,
  blocks: EditorBlock[],
): unknown[] {
  const resolved = resolveFormulaReference(ref, blocks, fieldSchemas);

  if (!resolved) {
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ref) && fieldSchemas?.[ref]) {
      return [resolveScalarFieldValue(ref, values, fieldSchemas, evaluating, blocks)];
    }
    throw new Error(`Unknown field reference: ${ref}`);
  }

  if (resolved.kind === 'scalar') {
    return [resolveScalarFieldValue(resolved.fieldId, values, fieldSchemas, evaluating, blocks)];
  }

  return resolved.cellIds.map((cellId) =>
    resolveScalarFieldValue(cellId, values, fieldSchemas, evaluating, blocks),
  );
}

function resolveReferenceDisplay(
  ref: string,
  values: ValueMap,
  fieldSchemas: FieldSchemaMap,
  evaluating: Set<string>,
  blocks: EditorBlock[],
): string {
  const rawValues = resolveReferenceValues(ref, values, fieldSchemas, evaluating, blocks);
  const nonEmpty = rawValues.filter((value) => value != null && value !== '');
  return nonEmpty.join('; ');
}

function numericValues(values: unknown[]): number[] {
  return values
    .map((value) => String(value ?? '').trim())
    .filter((value) => value !== '' && !Number.isNaN(Number(value)))
    .map((value) => Number(value));
}

function applyAggregate(name: string, values: unknown[]): number | string {
  const nonEmpty = values.filter((value) => value != null && value !== '');

  if (name === 'count') {
    return nonEmpty.length;
  }

  const nums = numericValues(nonEmpty);
  if (!nums.length) return '';

  if (name === 'sum') {
    return nums.reduce((total, value) => total + value, 0);
  }

  if (name === 'avg') {
    return nums.reduce((total, value) => total + value, 0) / nums.length;
  }

  if (name === 'min') {
    return Math.min(...nums);
  }

  if (name === 'max') {
    return Math.max(...nums);
  }

  throw new Error(`Unknown function: ${name}`);
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }

    if (c === '{') {
      const end = src.indexOf('}', i + 1);
      if (end === -1) throw new Error('Unclosed field reference');
      tokens.push({ type: 'FIELD', value: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }

    if (c === '"') {
      let j = i + 1;
      let str = '';
      while (j < src.length) {
        if (src[j] === '\\' && j + 1 < src.length) {
          str += src[j + 1];
          j += 2;
          continue;
        }
        if (src[j] === '"') break;
        str += src[j];
        j += 1;
      }
      if (src[j] !== '"') throw new Error('Unclosed string');
      tokens.push({ type: 'STRING', value: str });
      i = j + 1;
      continue;
    }

    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j]!)) j += 1;
      tokens.push({ type: 'NUMBER', value: Number(src.slice(i, j)) });
      i = j;
      continue;
    }

    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j]!)) j += 1;
      tokens.push({ type: 'IDENT', value: src.slice(i, j) });
      i = j;
      continue;
    }

    if ('+-*/()'.includes(c)) {
      if (c === '(') tokens.push({ type: 'LPAREN' });
      else if (c === ')') tokens.push({ type: 'RPAREN' });
      else tokens.push({ type: 'OP', value: c });
      i += 1;
      continue;
    }

    if (c === ',') {
      tokens.push({ type: 'COMMA' });
      i += 1;
      continue;
    }

    throw new Error(`Unexpected character: ${c}`);
  }

  tokens.push({ type: 'EOF' });
  return tokens;
}

class Parser {
  tokens: Token[];
  pos: number;
  values: ValueMap;
  fieldSchemas: FieldSchemaMap;
  evaluating: Set<string>;
  blocks: EditorBlock[];

  constructor(
    tokens: Token[],
    values: ValueMap | null | undefined,
    fieldSchemas: FieldSchemaMap | null | undefined,
    evaluating: Set<string> | null | undefined,
    blocks: EditorBlock[] | null | undefined,
  ) {
    this.tokens = tokens;
    this.pos = 0;
    this.values = values ?? {};
    this.fieldSchemas = fieldSchemas ?? {};
    this.evaluating = evaluating ?? new Set();
    this.blocks = blocks ?? [];
  }

  peek(): Token {
    return this.tokens[this.pos]!;
  }

  consume(type: Token['type'], value?: string): Token {
    const token = this.peek();
    if (
      token.type !== type ||
      (value != null && 'value' in token && token.value !== value)
    ) {
      throw new Error('Invalid formula syntax');
    }
    this.pos += 1;
    return token;
  }

  parseExpression(): unknown {
    let left: unknown = this.parseTerm();
    while (true) {
      const token = this.peek();
      if (token.type !== 'OP' || (token.value !== '+' && token.value !== '-')) break;
      const op = (this.consume('OP') as { type: 'OP'; value: string }).value;
      const right = this.parseTerm();
      if (op === '+') {
        if (isNumericValue(left) && isNumericValue(right)) {
          left = toNumber(left) + toNumber(right);
        } else {
          left = `${left ?? ''}${right ?? ''}`;
        }
      } else {
        left = toNumber(left) - toNumber(right);
      }
    }
    return left;
  }

  parseTerm(): unknown {
    let left: unknown = this.parseFactor();
    while (true) {
      const token = this.peek();
      if (token.type !== 'OP' || (token.value !== '*' && token.value !== '/')) break;
      const op = (this.consume('OP') as { type: 'OP'; value: string }).value;
      const right = this.parseFactor();
      if (op === '*') {
        left = toNumber(left) * toNumber(right);
      } else {
        const divisor = toNumber(right);
        if (divisor === 0) throw new Error('Division by zero');
        left = toNumber(left) / divisor;
      }
    }
    return left;
  }

  parseFactor(): unknown {
    const token = this.peek();

    if (token.type === 'NUMBER') {
      this.pos += 1;
      return token.value;
    }

    if (token.type === 'STRING') {
      this.pos += 1;
      return token.value;
    }

    if (token.type === 'FIELD') {
      this.pos += 1;
      return resolveReferenceDisplay(
        token.value,
        this.values,
        this.fieldSchemas,
        this.evaluating,
        this.blocks,
      );
    }

    if (token.type === 'IDENT') {
      const name = token.value;
      this.pos += 1;
      if (this.peek().type !== 'LPAREN') {
        throw new Error(`Unknown identifier: ${name}`);
      }
      return this.parseCall(name);
    }

    if (token.type === 'LPAREN') {
      this.consume('LPAREN');
      const value = this.parseExpression();
      this.consume('RPAREN');
      return value;
    }

    throw new Error('Invalid formula syntax');
  }

  parseCall(name: string): unknown {
    this.consume('LPAREN');

    if (['sum', 'avg', 'min', 'max', 'count'].includes(name)) {
      const token = this.peek();
      if (token.type !== 'FIELD') {
        throw new Error(`${name}() expects a field reference`);
      }
      this.pos += 1;
      const refValues = resolveReferenceValues(
        token.value,
        this.values,
        this.fieldSchemas,
        this.evaluating,
        this.blocks,
      );
      this.consume('RPAREN');
      return applyAggregate(name, refValues);
    }

    const args: unknown[] = [];
    if (this.peek().type !== 'RPAREN') {
      args.push(this.parseExpression());
      while (this.peek().type === 'COMMA') {
        this.consume('COMMA');
        args.push(this.parseExpression());
      }
    }
    this.consume('RPAREN');

    if (name === 'concat') {
      return args.map((arg) => arg ?? '').join('');
    }

    if (name === 'age') {
      if (args.length !== 1) throw new Error('age() expects one argument');
      return ageFromIsoDate(args[0]);
    }

    throw new Error(`Unknown function: ${name}`);
  }

  parse(): unknown {
    const value = this.parseExpression();
    if (this.peek().type !== 'EOF') throw new Error('Invalid formula syntax');
    return value;
  }
}

function evaluateFormulaInternal(
  formula: string | null | undefined,
  values: ValueMap,
  fieldSchemas: FieldSchemaMap,
  evaluating: Set<string>,
  blocks: EditorBlock[],
): FormulaResult {
  if (!formula?.trim()) return { value: '', error: null };

  try {
    const tokens = tokenize(formula);
    const parser = new Parser(tokens, values, fieldSchemas, evaluating, blocks);
    const result = parser.parse();
    return { value: formatResult(result), error: null };
  } catch (err) {
    return { value: '—', error: (err as Error).message ?? 'Formula error' };
  }
}

export function evaluateFormula(
  formula: string,
  values: ValueMap,
  fieldSchemas: FieldSchemaMap,
  options: EvaluateOptions = {},
): FormulaResult {
  const evaluating = new Set(options.evaluating ?? []);
  if (options.selfId) evaluating.add(options.selfId);
  return evaluateFormulaInternal(
    formula,
    values,
    fieldSchemas,
    evaluating,
    options.blocks ?? [],
  );
}

export function evaluateComputedField(
  fieldId: string,
  values: ValueMap,
  fieldSchemas: FieldSchemaMap,
  options: { blocks?: EditorBlock[] } = {},
): FormulaResult {
  const schema = fieldSchemas?.[fieldId];
  if (!schema || schema.type !== 'computed') return { value: '', error: null };
  return evaluateFormula((schema.formula as string | undefined) ?? '', values, fieldSchemas, {
    selfId: fieldId,
    blocks: options.blocks ?? [],
  });
}
