import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatNumericDisplay,
  formatCurrencyValue,
  parseCurrencyFormatSuffix,
} from './currency-format.js';

describe('currency-format', () => {
  it('formats field display settings', () => {
    assert.equal(formatNumericDisplay(42, { displayFormat: 'plain', suffix: 'mmHg' }), '42mmHg');
    assert.equal(
      formatNumericDisplay(1234.5, { displayFormat: 'number', fractionDigits: 2 }),
      formatCurrencyValue(1234.5, 'number:2'),
    );
    assert.equal(
      formatNumericDisplay(1234.5, {
        displayFormat: 'currency',
        currencyCode: 'EUR',
        fractionDigits: 2,
      }),
      formatCurrencyValue(1234.5, 'EUR:2'),
    );
  });

  it('parses mapping currency suffixes', () => {
    assert.deepEqual(parseCurrencyFormatSuffix('EUR:2'), {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    assert.deepEqual(parseCurrencyFormatSuffix('number'), {
      style: 'decimal',
      minimumFractionDigits: undefined,
      maximumFractionDigits: undefined,
    });
    assert.equal(parseCurrencyFormatSuffix('dd/mm/yyyy'), null);
  });
});
