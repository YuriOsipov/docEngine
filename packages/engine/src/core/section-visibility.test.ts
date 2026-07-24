import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateSectionVisibility } from './section-visibility.js';

describe('evaluateSectionVisibility', () => {
  it('shows a section when a show rule matches', () => {
    assert.equal(
      evaluateSectionVisibility(
        { fieldId: 'status', mode: 'show', operator: 'equals', value: 'active' },
        { status: 'active' },
      ),
      true,
    );
  });

  it('hides a section when a hide rule matches', () => {
    assert.equal(
      evaluateSectionVisibility(
        { fieldId: 'status', mode: 'hide', operator: 'equals', value: 'archived' },
        { status: 'archived' },
      ),
      false,
    );
  });

  it('matches array values with contains operators', () => {
    assert.equal(
      evaluateSectionVisibility(
        { fieldId: 'flags', mode: 'show', operator: 'contains', value: 'urgent' },
        { flags: ['urgent', 'review'] },
      ),
      true,
    );
  });

  it('supports empty and notEmpty operators', () => {
    assert.equal(
      evaluateSectionVisibility(
        { fieldId: 'notes', mode: 'show', operator: 'empty' },
        { notes: '' },
      ),
      true,
    );
    assert.equal(
      evaluateSectionVisibility(
        { fieldId: 'notes', mode: 'show', operator: 'notEmpty' },
        { notes: 'filled' },
      ),
      true,
    );
  });
});
