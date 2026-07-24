import { isFieldEmpty } from '../utils/field-values.js';
import type { FieldSchema } from '../types.js';

export type SectionVisibilityOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'empty'
  | 'notEmpty';

export type SectionVisibilityMode = 'show' | 'hide';

export interface SectionVisibilityRule {
  fieldId?: string;
  mode?: SectionVisibilityMode;
  operator?: SectionVisibilityOperator;
  value?: unknown;
}

function toValueArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? ''));
  if (value == null || value === '') return [];
  return [String(value)];
}

function valueEquals(actual: unknown, expected: unknown): boolean {
  const expectedValues = toValueArray(expected);
  if (!expectedValues.length) return toValueArray(actual).length === 0;
  return toValueArray(actual).some((item) => expectedValues.includes(item));
}

function ruleMatches(
  rule: SectionVisibilityRule,
  fieldValues: Record<string, unknown>,
  fieldSchemas: Record<string, FieldSchema | undefined> = {},
): boolean {
  const fieldId = String(rule.fieldId ?? '').trim();
  if (!fieldId) return true;

  const schema = fieldSchemas[fieldId];
  const value = fieldValues[fieldId];
  const operator = rule.operator ?? 'equals';
  const empty = isFieldEmpty(value, { schema, htmlEditor: !!schema?.htmlEditor });

  switch (operator) {
    case 'empty':
      return empty;
    case 'notEmpty':
      return !empty;
    case 'notEquals':
      return !valueEquals(value, rule.value);
    case 'contains':
      return valueEquals(value, rule.value);
    case 'notContains':
      return !valueEquals(value, rule.value);
    case 'equals':
    default:
      return valueEquals(value, rule.value);
  }
}

export function evaluateSectionVisibility(
  rule: SectionVisibilityRule | null | undefined,
  fieldValues: Record<string, unknown> = {},
  fieldSchemas: Record<string, FieldSchema | undefined> = {},
): boolean {
  if (!rule?.fieldId) return true;
  const matches = ruleMatches(rule, fieldValues, fieldSchemas);
  return (rule.mode ?? 'show') === 'hide' ? !matches : matches;
}
