import { describe, expect, test } from 'vitest';
import { parseAmount, SEPARATORS } from './AmountInput';

const { group, decimal } = SEPARATORS;

describe('parseAmount', () => {
  test('drops any non-numeric characters', () => {
    expect(parseAmount('ab1c2d3', 0).value).toBe(123);
    expect(parseAmount('50.000 rupiah'.replaceAll('.', group), 0).value).toBe(50000);
    expect(parseAmount('!@#$', 0).value).toBe(null);
  });

  test('formats the integer part with grouping separators', () => {
    expect(parseAmount('1000000', 0).text).toBe(`1${group}000${group}000`);
  });

  test('re-parsing its own formatted output is stable (no separator confusion)', () => {
    const first = parseAmount('1234567', 0);
    const second = parseAmount(first.text, 0);
    expect(second.value).toBe(1234567);
    expect(second.text).toBe(first.text);
  });

  test('keeps one decimal separator and caps the fraction length', () => {
    const r = parseAmount(`12${decimal}3456`, 2);
    expect(r.value).toBe(12.34);
    expect(r.text).toBe(`12${decimal}34`);
  });

  test('ignores the decimal separator entirely when maxDecimals is 0', () => {
    expect(parseAmount(`12${decimal}99`, 0).value).toBe(1299);
  });

  test('preserves a trailing decimal separator while typing', () => {
    expect(parseAmount(`5${decimal}`, 2).text).toBe(`5${decimal}`);
  });

  test('normalises leading zeros but keeps a lone zero', () => {
    expect(parseAmount('007', 0).text).toBe('7');
    expect(parseAmount('0', 0).text).toBe('0');
    expect(parseAmount('', 0).value).toBe(null);
  });
});
