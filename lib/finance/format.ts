// Render a money figure with its currency code. We never blend currencies, so the
// code is always shown alongside the number (PRD 5.7). Plain locale grouping —
// amounts are stored as base-unit numbers (PRD 5.1), not minor units.
export function formatMoney(currency: string, amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}${currency} ${Math.abs(amount).toLocaleString()}`;
}
