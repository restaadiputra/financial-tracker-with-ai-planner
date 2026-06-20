import type { FinanceTrackerDB } from '@/lib/db/db';
import type { RecurringRule } from '@/lib/db/schema';
import { addTransaction } from '@/lib/db/transactions';
import { recurringRules } from '@/lib/db/recurringRules';

// Recurring transactions are generated lazily — there is no service worker or
// background job (PRD 5.4). On app load we ask each active rule for the
// occurrences that fell due since it last generated, up to and including today,
// materialise a real Transaction for each, and advance the rule's
// lastGeneratedDate. Generation is idempotent: re-running on the same day yields
// nothing new because every produced occurrence is <= lastGeneratedDate.

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// A given day-of-month, clamped to the target month's length (e.g. the 31st in
// February lands on the 28th/29th) and normalised to local midnight.
function occurrenceInMonth(year: number, month: number, dayOfMonth: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dayOfMonth, lastDay)).getTime();
}

function firstOccurrence(rule: RecurringRule): number {
  const start = new Date(rule.startDate);
  const startDay = startOfDay(rule.startDate);

  switch (rule.frequency) {
    case 'daily':
      return startDay;
    case 'weekly': {
      const target = rule.dayOfWeek ?? start.getDay();
      const offset = (target - new Date(startDay).getDay() + 7) % 7;
      return startDay + offset * 86_400_000;
    }
    case 'monthly': {
      const dom = rule.dayOfMonth ?? start.getDate();
      const thisMonth = occurrenceInMonth(start.getFullYear(), start.getMonth(), dom);
      return thisMonth >= startDay
        ? thisMonth
        : occurrenceInMonth(start.getFullYear(), start.getMonth() + 1, dom);
    }
    case 'yearly': {
      const dom = rule.dayOfMonth ?? start.getDate();
      const thisYear = occurrenceInMonth(start.getFullYear(), start.getMonth(), dom);
      return thisYear >= startDay
        ? thisYear
        : occurrenceInMonth(start.getFullYear() + 1, start.getMonth(), dom);
    }
  }
}

function nextOccurrence(rule: RecurringRule, occurrence: number): number {
  const d = new Date(occurrence);
  switch (rule.frequency) {
    case 'daily':
      return occurrence + 86_400_000;
    case 'weekly':
      return occurrence + 7 * 86_400_000;
    case 'monthly':
      return occurrenceInMonth(d.getFullYear(), d.getMonth() + 1, rule.dayOfMonth ?? d.getDate());
    case 'yearly':
      return occurrenceInMonth(d.getFullYear() + 1, d.getMonth(), rule.dayOfMonth ?? d.getDate());
  }
}

// Occurrence dates (local midnight, epoch ms) that should be generated now:
// strictly after lastGeneratedDate, up to and including today, bounded by endDate.
export function dueOccurrences(rule: RecurringRule, now: number = Date.now()): number[] {
  if (!rule.isActive) return [];

  const today = startOfDay(now);
  const after = rule.lastGeneratedDate ?? -Infinity;
  const occurrences: number[] = [];

  let occ = firstOccurrence(rule);
  // Guard against pathological rules (e.g. a far-past daily start) so a single
  // load can't spin forever; ~13 years of daily occurrences is plenty.
  for (let guard = 0; occ <= today && guard < 5000; guard++) {
    if (occ > after && (rule.endDate == null || occ <= rule.endDate)) occurrences.push(occ);
    occ = nextOccurrence(rule, occ);
  }
  return occurrences;
}

// Materialises due transactions for every active rule of a profile and advances
// each rule's lastGeneratedDate. Returns how many transactions were created.
export async function generateDueTransactions(
  db: FinanceTrackerDB,
  key: CryptoKey,
  profileId: string,
  now: number = Date.now()
): Promise<number> {
  const rules = await recurringRules.list(db, key, profileId);
  let created = 0;

  for (const rule of rules) {
    const occurrences = dueOccurrences(rule, now);
    if (occurrences.length === 0) continue;

    for (const date of occurrences) {
      await addTransaction(db, key, profileId, {
        type: rule.type,
        amount: rule.amount,
        currency: rule.currency,
        category: rule.category,
        note: rule.note,
        date,
        recurringRuleId: rule.id,
      });
      created += 1;
    }
    await recurringRules.update(db, key, rule.id, {
      lastGeneratedDate: occurrences[occurrences.length - 1],
    });
  }

  return created;
}
