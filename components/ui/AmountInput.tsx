'use client';

import { useState } from 'react';

// Locale-aware separators, derived once. Using the runtime locale keeps the
// input's grouping identical to how amounts render elsewhere via toLocaleString
// (lib/finance/format.ts) — e.g. "1,000" in en-US, "1.000" in id-ID.
const GROUP_SEPARATOR = new Intl.NumberFormat()
  .formatToParts(11111)
  .find((p) => p.type === 'group')?.value ?? ',';
const DECIMAL_SEPARATOR = new Intl.NumberFormat()
  .formatToParts(1.1)
  .find((p) => p.type === 'decimal')?.value ?? '.';

/**
 * Parse arbitrary keystrokes into a clean, grouped money string and a numeric
 * value. Non-numeric characters are simply dropped, so the field can never hold
 * letters or symbols; at most one decimal separator is kept, and the fractional
 * part is capped at `maxDecimals`. A trailing separator ("1.") is preserved so
 * the user can keep typing the decimal part.
 */
export const SEPARATORS = { group: GROUP_SEPARATOR, decimal: DECIMAL_SEPARATOR };

export function parseAmount(raw: string, maxDecimals: number): { text: string; value: number | null } {
  // Drop grouping separators first (the displayed value already contains them),
  // so only the locale decimal separator can introduce a fractional part. This is
  // what keeps "1,234" in en-US from being read as "1.234".
  const stripped = GROUP_SEPARATOR ? raw.split(GROUP_SEPARATOR).join('') : raw;

  let intDigits = '';
  let fracDigits = '';
  let seenDecimal = false;

  for (const ch of stripped) {
    if (ch >= '0' && ch <= '9') {
      if (seenDecimal) {
        if (fracDigits.length < maxDecimals) fracDigits += ch;
      } else {
        intDigits += ch;
      }
    } else if (ch === DECIMAL_SEPARATOR && maxDecimals > 0 && !seenDecimal) {
      seenDecimal = true;
    }
  }

  intDigits = intDigits.replace(/^0+(?=\d)/, ''); // drop leading zeros, keep a lone "0"
  const hasDigits = intDigits.length > 0 || fracDigits.length > 0;
  const value = hasDigits ? Number(`${intDigits || '0'}.${fracDigits || '0'}`) : null;

  const groupedInt =
    intDigits.length > 0
      ? Number(intDigits).toLocaleString(undefined, { maximumFractionDigits: 0 })
      : seenDecimal
        ? '0'
        : '';
  const text = seenDecimal ? `${groupedInt}${DECIMAL_SEPARATOR}${fracDigits}` : groupedInt;

  return { text, value };
}

function formatInitial(value: number | undefined, maxDecimals: number): string {
  if (value == null) return '';
  return parseAmount(value.toString().replace('.', DECIMAL_SEPARATOR), maxDecimals).text;
}

export function AmountInput({
  initialValue,
  onValueChange,
  maxDecimals = 2,
  className = '',
  ...rest
}: {
  initialValue?: number;
  onValueChange: (value: number | null) => void;
  maxDecimals?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'>) {
  const [text, setText] = useState(() => formatInitial(initialValue, maxDecimals));

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { text: next, value } = parseAmount(event.target.value, maxDecimals);
    setText(next);
    onValueChange(value);
  }

  return (
    <input
      {...rest}
      // Decimal keypad on mobile; the parser still guarantees numeric-only content
      // even on hardware keyboards that ignore inputMode.
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={handleChange}
      className={className}
    />
  );
}
