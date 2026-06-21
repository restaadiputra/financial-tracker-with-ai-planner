# AI Planner (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI Planner per `docs/superpowers/specs/2026-06-21-ai-planner-design.md`: a stateless `/api/ai/plan` route, a planner chat page, a confirm-before-write step for any AI-proposed goal/budget, a tracked-plan widget that reads live from Dexie, and a manual/debounced suggestion refresh.

**Architecture:** Client aggregates the active profile's last-90-days spending + existing budgets/goals into a compact `PlanContext` (no raw transaction dump), sends it with the chat message to a stateless Node-runtime API route, which rate-limits, calls the Anthropic API directly via `fetch` (no SDK dependency, matching this repo's zero-extra-dependency posture for crypto), parses the model's JSON-only reply (failing open to plain chat on any parse error), and returns it. The client never auto-writes a proposed plan — it shows a checkbox-per-line confirm card first. Confirmed lines are stamped with a shared `aiPlanBatchId` on the `Goal`/`Budget` records so a `useLiveQuery` widget can always find and render the latest AI-confirmed plan, persisting across reloads without a new DB table.

**Tech Stack:** Next.js 15 App Router (Node runtime route handler), TypeScript strict, Dexie/`dexie-react-hooks` (existing), native `fetch` to the Anthropic Messages API (no `@anthropic-ai/sdk` dependency added), Vitest for `lib/` unit tests (existing pattern — this repo does not unit-test React components, only pure logic).

## Global Constraints

- No financial data ever touches a server — the `/api/ai/plan` route receives only the aggregated `PlanContext` + chat text, writes nothing to any DB, logs nothing (CLAUDE.md principle 1 & 3).
- Never auto-write an AI-proposed plan; every write requires the user to pass through `PlanConfirmCard` first (CLAUDE.md / DESIGN.md "Confirm before the AI touches real data").
- Per-currency clarity: never blend currencies into one total; every amount shown carries its currency (PRD 5.7, DESIGN.md).
- `SIMPLICITY NOTE` comments required at: chat-history-is-session-only, aggregated-context-not-raw-transactions, fetch-instead-of-SDK, in-memory rate limiter (all per the design spec).
- Follow existing code conventions exactly: `lib/db/encryptedStore.ts`-style stores already exist for `goals`/`budgets` — reuse `goalStore`/`budgetStore`, do not add new DB tables for chat history.
- Visual: use existing `components/ui/controls.ts` button classes and the existing teal accent only — no new colors (DESIGN.md One Accent Rule).
- TypeScript strict; run `npm run typecheck` and `npm test` after every task that touches `lib/`.

---

### Task 1: Add `aiPlanBatchId` to the `Goal` and `Budget` schema

**Files:**
- Modify: `lib/db/schema.ts`

**Interfaces:**
- Produces: `Goal.aiPlanBatchId?: string`, `Budget.aiPlanBatchId?: string` — consumed by Task 5 (`planBatch.ts`) and Task 14 (planner page).

- [ ] **Step 1: Edit the `Budget` interface**

In `lib/db/schema.ts`, find:

```typescript
// Decrypted shape of a budget envelope — see PRD Section 5.3.
export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  currency: string;
  period: 'monthly'; // v1: monthly only — see PRD Section 5.3 SIMPLICITY NOTE.
  alertThresholdPct: number; // e.g. 80 — overspend warning fires at this % spent.
  createdAt: number;
}
```

Replace with:

```typescript
// Decrypted shape of a budget envelope — see PRD Section 5.3.
export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  currency: string;
  period: 'monthly'; // v1: monthly only — see PRD Section 5.3 SIMPLICITY NOTE.
  alertThresholdPct: number; // e.g. 80 — overspend warning fires at this % spent.
  createdAt: number;
  // Set when this budget was created/adjusted via a confirmed AI Planner proposal —
  // shared with the Goal created in the same confirm action so the planner's
  // TrackedPlanWidget can find the whole batch. Provenance only, not a lock —
  // editing the budget manually afterward keeps it. See PRD Section 6 / AI Planner spec.
  aiPlanBatchId?: string;
}
```

- [ ] **Step 2: Edit the `Goal` interface**

Find:

```typescript
  linkedCategoryId?: string; // optional: auto-derive progress from this category's transactions.
  createdAt: number;
}
```

(this is the end of the `Goal` interface — confirm by checking the line above it is `interface Goal {`). Replace with:

```typescript
  linkedCategoryId?: string; // optional: auto-derive progress from this category's transactions.
  createdAt: number;
  // Set when this goal was created via a confirmed AI Planner proposal — see the
  // matching field on Budget above for the full rationale.
  aiPlanBatchId?: string;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors (both fields are optional, so no existing call site breaks).

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat: add aiPlanBatchId to Goal and Budget for AI Planner provenance"
```

---

### Task 2: Rate limiter

**Files:**
- Create: `lib/ai/rateLimit.ts`
- Test: `lib/ai/rateLimit.test.ts`

**Interfaces:**
- Produces: `checkRateLimit(ip: string, now?: number): { allowed: boolean; retryAfterMs: number }`, `_resetRateLimitForTests(): void` — consumed by Task 8 (route handler) and this task's own test.

- [ ] **Step 1: Write the failing test**

Create `lib/ai/rateLimit.test.ts`:

```typescript
import { beforeEach, describe, expect, test } from 'vitest';
import { _resetRateLimitForTests, checkRateLimit } from './rateLimit';

beforeEach(() => {
  _resetRateLimitForTests();
});

describe('checkRateLimit', () => {
  test('allows requests up to the limit within a window', () => {
    let now = 0;
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('1.2.3.4', now).allowed).toBe(true);
    }
  });

  test('blocks the 11th request within the same window', () => {
    const now = 0;
    for (let i = 0; i < 10; i++) checkRateLimit('1.2.3.4', now);
    const result = checkRateLimit('1.2.3.4', now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  test('resets once the window has elapsed', () => {
    let now = 0;
    for (let i = 0; i < 10; i++) checkRateLimit('1.2.3.4', now);
    now += 60_001;
    expect(checkRateLimit('1.2.3.4', now).allowed).toBe(true);
  });

  test('tracks each IP independently', () => {
    const now = 0;
    for (let i = 0; i < 10; i++) checkRateLimit('1.2.3.4', now);
    expect(checkRateLimit('5.6.7.8', now).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/rateLimit.test.ts`
Expected: FAIL — `Cannot find module './rateLimit'`

- [ ] **Step 3: Write the implementation**

Create `lib/ai/rateLimit.ts`:

```typescript
// SIMPLICITY NOTE: module-scope in-memory map, no Redis/edge-config dependency.
// Resets on server restart and doesn't share state across instances — acceptable
// for a single-instance personal/small-scale deployment per PRD Section 6.5;
// revisit only if this app gets multi-instance traffic.

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count < MAX_REQUESTS_PER_WINDOW) {
    bucket.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  return { allowed: false, retryAfterMs: WINDOW_MS - (now - bucket.windowStart) };
}

// Test-only: clears all buckets so rateLimit.test.ts cases don't bleed into each other.
export function _resetRateLimitForTests(): void {
  buckets.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/rateLimit.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/ai/rateLimit.ts lib/ai/rateLimit.test.ts
git commit -m "feat: add in-memory per-IP rate limiter for the AI Planner route"
```

---

### Task 3: Plan context summary builder

**Files:**
- Create: `lib/ai/contextSummary.ts`
- Test: `lib/ai/contextSummary.test.ts`

**Interfaces:**
- Consumes: `Transaction`, `Budget`, `Goal` from `lib/db/schema.ts` (existing).
- Produces: `CategorySummary`, `BudgetSummary`, `GoalSummary`, `PlanContext` types, and `buildPlanContext(transactions: Transaction[], budgets: Budget[], goals: Goal[], now?: number): PlanContext` — consumed by Task 14 (planner page) and Task 8 (route, as the request body's `context` shape).

- [ ] **Step 1: Write the failing test**

Create `lib/ai/contextSummary.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import type { Budget, Goal, Transaction } from '@/lib/db/schema';
import { buildPlanContext } from './contextSummary';

const DAY_MS = 86_400_000;

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    type: 'expense',
    amount: 0,
    currency: 'IDR',
    category: 'food',
    date: Date.now(),
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe('buildPlanContext', () => {
  test('aggregates income/expense per category and currency within the last 90 days', () => {
    const now = new Date('2026-06-21').getTime();
    const transactions = [
      tx({ amount: 50_000, category: 'food', currency: 'IDR', date: now - 1 * DAY_MS }),
      tx({ amount: 20_000, category: 'food', currency: 'IDR', date: now - 2 * DAY_MS }),
      tx({ amount: 5_000_000, type: 'income', category: 'salary', currency: 'IDR', date: now - 3 * DAY_MS }),
      tx({ amount: 10, category: 'food', currency: 'USD', date: now - 4 * DAY_MS }), // separate currency bucket
      tx({ amount: 99_999, category: 'food', currency: 'IDR', date: now - 91 * DAY_MS }), // outside window
    ];

    const context = buildPlanContext(transactions, [], [], now);

    const food = context.categorySummaries.find((c) => c.categoryId === 'food' && c.currency === 'IDR');
    expect(food).toEqual({ categoryId: 'food', currency: 'IDR', income: 0, expense: 70_000 });

    const salary = context.categorySummaries.find((c) => c.categoryId === 'salary');
    expect(salary).toEqual({ categoryId: 'salary', currency: 'IDR', income: 5_000_000, expense: 0 });

    const foodUsd = context.categorySummaries.find((c) => c.categoryId === 'food' && c.currency === 'USD');
    expect(foodUsd).toEqual({ categoryId: 'food', currency: 'USD', income: 0, expense: 10 });

    // the 91-day-old transaction must not appear in any bucket's totals
    expect(context.categorySummaries.reduce((sum, c) => sum + c.expense, 0)).toBe(70_010);
  });

  test('passes through budgets and goals as compact summaries', () => {
    const budgets: Budget[] = [
      { id: 'b1', categoryId: 'food', amount: 1_000_000, currency: 'IDR', period: 'monthly', alertThresholdPct: 80, createdAt: 0 },
    ];
    const goals: Goal[] = [
      { id: 'g1', name: 'Laptop', type: 'savings', targetAmount: 10_000_000, currentAmount: 2_000_000, currency: 'IDR', createdAt: 0 },
    ];

    const context = buildPlanContext([], budgets, goals, Date.now());

    expect(context.budgets).toEqual([
      { categoryId: 'food', amount: 1_000_000, currency: 'IDR', alertThresholdPct: 80 },
    ]);
    expect(context.goals).toEqual([
      { name: 'Laptop', type: 'savings', targetAmount: 10_000_000, currentAmount: 2_000_000, currency: 'IDR', targetDate: undefined },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/contextSummary.test.ts`
Expected: FAIL — `Cannot find module './contextSummary'`

- [ ] **Step 3: Write the implementation**

Create `lib/ai/contextSummary.ts`:

```typescript
import type { Budget, Goal, Transaction } from '@/lib/db/schema';

export interface CategorySummary {
  categoryId: string;
  currency: string;
  income: number;
  expense: number;
}

export interface BudgetSummary {
  categoryId: string;
  amount: number;
  currency: string;
  alertThresholdPct: number;
}

export interface GoalSummary {
  name: string;
  type: Goal['type'];
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate?: number;
}

export interface PlanContext {
  periodStart: number;
  periodEnd: number;
  categorySummaries: CategorySummary[];
  budgets: BudgetSummary[];
  goals: GoalSummary[];
}

const CONTEXT_WINDOW_MS = 90 * 86_400_000;

// SIMPLICITY NOTE: sends the AI per-category/per-currency aggregates instead of
// raw transactions (PRD Section 6.1, CLAUDE.md principle 3 — minimum data needed).
// Smaller payload, cheaper, and never exposes individual notes/merchants to the
// API call. The AI only ever reasons about category-level totals, which is
// sufficient for budgeting/savings advice.
export function buildPlanContext(
  transactions: Transaction[],
  budgets: Budget[],
  goals: Goal[],
  now: number = Date.now()
): PlanContext {
  const periodStart = now - CONTEXT_WINDOW_MS;
  const periodEnd = now;

  const byKey = new Map<string, CategorySummary>();
  for (const t of transactions) {
    if (t.date < periodStart || t.date > periodEnd) continue;
    const key = `${t.category}::${t.currency}`;
    const existing = byKey.get(key) ?? {
      categoryId: t.category,
      currency: t.currency,
      income: 0,
      expense: 0,
    };
    if (t.type === 'income') existing.income += t.amount;
    else existing.expense += t.amount;
    byKey.set(key, existing);
  }

  return {
    periodStart,
    periodEnd,
    categorySummaries: Array.from(byKey.values()),
    budgets: budgets.map((b) => ({
      categoryId: b.categoryId,
      amount: b.amount,
      currency: b.currency,
      alertThresholdPct: b.alertThresholdPct,
    })),
    goals: goals.map((g) => ({
      name: g.name,
      type: g.type,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      currency: g.currency,
      targetDate: g.targetDate,
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/contextSummary.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/ai/contextSummary.ts lib/ai/contextSummary.test.ts
git commit -m "feat: add AI Planner context summary builder (90-day category aggregates)"
```

---

### Task 4: Structured response parser

**Files:**
- Create: `lib/ai/planSchema.ts`
- Test: `lib/ai/planSchema.test.ts`

**Interfaces:**
- Produces: `BudgetAdjustment`, `ProposedPlan`, `AIPlannerResponse` types, and `parsePlannerResponse(raw: string): AIPlannerResponse` — consumed by Task 8 (route handler) and Task 11/14 (PlanConfirmCard, planner page, via the `AIPlannerResponse`/`ProposedPlan` types).

- [ ] **Step 1: Write the failing test**

Create `lib/ai/planSchema.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { parsePlannerResponse } from './planSchema';

describe('parsePlannerResponse', () => {
  test('parses a plain JSON message with no proposed plan', () => {
    const raw = JSON.stringify({ message: 'You are on track.' });
    expect(parsePlannerResponse(raw)).toEqual({ message: 'You are on track.', proposedPlan: undefined });
  });

  test('parses a JSON message wrapped in a markdown code fence', () => {
    const raw = '```json\n' + JSON.stringify({ message: 'Hi' }) + '\n```';
    expect(parsePlannerResponse(raw)).toEqual({ message: 'Hi', proposedPlan: undefined });
  });

  test('parses a valid proposedPlan with budget adjustments', () => {
    const payload = {
      message: "Here's a plan.",
      proposedPlan: {
        type: 'savings_goal',
        goalName: 'Emergency fund',
        targetAmount: 10_000_000,
        currency: 'IDR',
        budgetAdjustments: [{ categoryId: 'food', suggestedAmount: 800_000 }],
      },
    };
    expect(parsePlannerResponse(JSON.stringify(payload))).toEqual(payload);
  });

  test('fails open to a plain message when JSON is malformed', () => {
    const raw = 'not json at all';
    expect(parsePlannerResponse(raw)).toEqual({ message: 'not json at all', proposedPlan: undefined });
  });

  test('fails open and drops proposedPlan when its shape is invalid', () => {
    const raw = JSON.stringify({ message: 'Hi', proposedPlan: { type: 'not_a_real_type' } });
    expect(parsePlannerResponse(raw)).toEqual({ message: 'Hi', proposedPlan: undefined });
  });

  test('fails open and drops proposedPlan when a budget adjustment is malformed', () => {
    const raw = JSON.stringify({
      message: 'Hi',
      proposedPlan: { type: 'budget_adjustment', budgetAdjustments: [{ categoryId: 'food' }] },
    });
    expect(parsePlannerResponse(raw)).toEqual({ message: 'Hi', proposedPlan: undefined });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/planSchema.test.ts`
Expected: FAIL — `Cannot find module './planSchema'`

- [ ] **Step 3: Write the implementation**

Create `lib/ai/planSchema.ts`:

```typescript
export interface BudgetAdjustment {
  categoryId: string;
  suggestedAmount: number;
}

export interface ProposedPlan {
  type: 'savings_goal' | 'budget_adjustment';
  goalName?: string;
  targetAmount?: number;
  currency?: string;
  targetDate?: number;
  budgetAdjustments?: BudgetAdjustment[];
}

export interface AIPlannerResponse {
  message: string;
  proposedPlan?: ProposedPlan;
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : trimmed;
}

function isValidBudgetAdjustment(value: unknown): value is BudgetAdjustment {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as BudgetAdjustment).categoryId === 'string' &&
    typeof (value as BudgetAdjustment).suggestedAmount === 'number'
  );
}

function isValidProposedPlan(value: unknown): value is ProposedPlan {
  if (typeof value !== 'object' || value === null) return false;
  const plan = value as ProposedPlan;
  if (plan.type !== 'savings_goal' && plan.type !== 'budget_adjustment') return false;
  if (plan.budgetAdjustments !== undefined) {
    if (!Array.isArray(plan.budgetAdjustments)) return false;
    if (!plan.budgetAdjustments.every(isValidBudgetAdjustment)) return false;
  }
  return true;
}

// Parses the model's raw text into AIPlannerResponse. Always succeeds: malformed
// JSON or a wrong shape falls back to a plain message with no proposedPlan rather
// than throwing, so a bad model reply never breaks the chat (design spec
// "Structured output parsing").
export function parsePlannerResponse(raw: string): AIPlannerResponse {
  const candidate = stripCodeFence(raw);
  try {
    const parsed = JSON.parse(candidate);
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.message === 'string') {
      const proposedPlan = isValidProposedPlan(parsed.proposedPlan) ? parsed.proposedPlan : undefined;
      return { message: parsed.message, proposedPlan };
    }
  } catch {
    // fall through to fail-open below
  }
  return { message: raw, proposedPlan: undefined };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/planSchema.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/ai/planSchema.ts lib/ai/planSchema.test.ts
git commit -m "feat: add fail-open JSON parser for AI Planner structured responses"
```

---

### Task 5: Latest AI plan batch lookup

**Files:**
- Create: `lib/ai/planBatch.ts`
- Test: `lib/ai/planBatch.test.ts`

**Interfaces:**
- Consumes: `Goal`, `Budget` from `lib/db/schema.ts` (with `aiPlanBatchId` from Task 1).
- Produces: `PlanBatch` type, `findLatestPlanBatch(goals: Goal[], budgets: Budget[]): PlanBatch | null` — consumed by Task 12 (`TrackedPlanWidget`).

- [ ] **Step 1: Write the failing test**

Create `lib/ai/planBatch.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import type { Budget, Goal } from '@/lib/db/schema';
import { findLatestPlanBatch } from './planBatch';

function goal(partial: Partial<Goal>): Goal {
  return {
    id: crypto.randomUUID(),
    name: 'Goal',
    type: 'savings',
    targetAmount: 1,
    currentAmount: 0,
    currency: 'IDR',
    createdAt: 0,
    ...partial,
  };
}

function budget(partial: Partial<Budget>): Budget {
  return {
    id: crypto.randomUUID(),
    categoryId: 'food',
    amount: 1,
    currency: 'IDR',
    period: 'monthly',
    alertThresholdPct: 80,
    createdAt: 0,
    ...partial,
  };
}

describe('findLatestPlanBatch', () => {
  test('returns null when nothing has an aiPlanBatchId', () => {
    expect(findLatestPlanBatch([goal({})], [budget({})])).toBeNull();
  });

  test('picks the batch with the newest createdAt across its goal and budgets', () => {
    const olderGoal = goal({ aiPlanBatchId: 'batch-old', createdAt: 100, name: 'Old goal' });
    const newerGoal = goal({ aiPlanBatchId: 'batch-new', createdAt: 300, name: 'New goal' });
    const newerBudget = budget({ aiPlanBatchId: 'batch-new', createdAt: 200, categoryId: 'food' });
    const olderBudget = budget({ aiPlanBatchId: 'batch-old', createdAt: 50, categoryId: 'transport' });

    const result = findLatestPlanBatch([olderGoal, newerGoal], [newerBudget, olderBudget]);

    expect(result?.id).toBe('batch-new');
    expect(result?.goal?.name).toBe('New goal');
    expect(result?.budgets).toEqual([newerBudget]);
  });

  test('handles a batch with budgets but no goal', () => {
    const b = budget({ aiPlanBatchId: 'batch-1', createdAt: 10 });
    const result = findLatestPlanBatch([], [b]);
    expect(result).toEqual({ id: 'batch-1', goal: undefined, budgets: [b] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/planBatch.test.ts`
Expected: FAIL — `Cannot find module './planBatch'`

- [ ] **Step 3: Write the implementation**

Create `lib/ai/planBatch.ts`:

```typescript
import type { Budget, Goal } from '@/lib/db/schema';

export interface PlanBatch {
  id: string;
  goal?: Goal;
  budgets: Budget[];
}

// Picks the most recently created AI plan batch (by the newest createdAt across
// its goal/budget records) so TrackedPlanWidget always shows the latest
// AI-confirmed plan, even if the user has older AI batches or manual goals too.
export function findLatestPlanBatch(goals: Goal[], budgets: Budget[]): PlanBatch | null {
  const batchIds = new Set<string>();
  for (const g of goals) if (g.aiPlanBatchId) batchIds.add(g.aiPlanBatchId);
  for (const b of budgets) if (b.aiPlanBatchId) batchIds.add(b.aiPlanBatchId);
  if (batchIds.size === 0) return null;

  let latestId: string | null = null;
  let latestCreatedAt = -Infinity;

  for (const id of batchIds) {
    const createdAts = [
      ...goals.filter((g) => g.aiPlanBatchId === id).map((g) => g.createdAt),
      ...budgets.filter((b) => b.aiPlanBatchId === id).map((b) => b.createdAt),
    ];
    const createdAt = Math.max(...createdAts);
    if (createdAt > latestCreatedAt) {
      latestCreatedAt = createdAt;
      latestId = id;
    }
  }

  return {
    id: latestId!,
    goal: goals.find((g) => g.aiPlanBatchId === latestId),
    budgets: budgets.filter((b) => b.aiPlanBatchId === latestId),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/planBatch.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/ai/planBatch.ts lib/ai/planBatch.test.ts
git commit -m "feat: add findLatestPlanBatch for the AI Planner tracked-plan widget"
```

---

### Task 6: Required-pace calculation

**Files:**
- Modify: `lib/finance/calculations.ts`
- Test: `lib/finance/calculations.test.ts`

**Interfaces:**
- Produces: `requiredDailyPace(targetAmount: number, currentAmount: number, targetDate: number, now?: number): number` — consumed by Task 12 (`TrackedPlanWidget`).

- [ ] **Step 1: Write the failing test**

Append to `lib/finance/calculations.test.ts` (add this `import` name to the existing import line, and add this new `describe` block at the end of the file):

Change the top import line from:

```typescript
import { currentMonthRange, goalProgress, netWorthByCurrency, spentInCategory } from './calculations';
```

to:

```typescript
import { currentMonthRange, goalProgress, netWorthByCurrency, requiredDailyPace, spentInCategory } from './calculations';
```

Then append at the end of the file:

```typescript

describe('requiredDailyPace', () => {
  test('divides the remaining amount by whole days remaining', () => {
    const now = new Date('2026-06-20').getTime();
    const targetDate = new Date('2026-06-30').getTime(); // 10 days out
    expect(requiredDailyPace(10_000_000, 4_000_000, targetDate, now)).toBe(600_000);
  });

  test('floors days remaining at 1 so an overdue/today target does not divide by zero or go negative', () => {
    const now = new Date('2026-06-20T12:00:00').getTime();
    const targetDate = new Date('2026-06-20T08:00:00').getTime(); // already past
    expect(requiredDailyPace(1_000_000, 0, targetDate, now)).toBe(1_000_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/finance/calculations.test.ts`
Expected: FAIL — `requiredDailyPace is not exported` / `is not a function`

- [ ] **Step 3: Write the implementation**

In `lib/finance/calculations.ts`, append this function at the end of the file:

```typescript

// Daily amount still needed to hit a goal by targetDate, from today (PRD Section
// 6.3 "Required daily/weekly pace"). Days remaining is floored at 1 so an overdue
// or same-day target gives a real number instead of dividing by zero or going
// negative — the UI should show "you need X today", not an error.
export function requiredDailyPace(
  targetAmount: number,
  currentAmount: number,
  targetDate: number,
  now: number = Date.now()
): number {
  const remaining = targetAmount - currentAmount;
  const daysRemaining = Math.max(1, Math.ceil((targetDate - now) / 86_400_000));
  return remaining / daysRemaining;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/finance/calculations.test.ts`
Expected: PASS (all existing tests + 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add lib/finance/calculations.ts lib/finance/calculations.test.ts
git commit -m "feat: add requiredDailyPace for the AI Planner tracked-plan widget"
```

---

### Task 7: Anthropic API client

**Files:**
- Create: `lib/ai/anthropicClient.ts`
- Test: `lib/ai/anthropicClient.test.ts`

**Interfaces:**
- Produces: `ChatTurn` type (`{ role: 'user' | 'assistant'; content: string }`), `AnthropicConfigError` class, `callPlannerModel(systemPrompt: string, history: ChatTurn[]): Promise<string>` — consumed by Task 8 (route handler).

- [ ] **Step 1: Write the failing test**

Create `lib/ai/anthropicClient.test.ts`:

```typescript
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AnthropicConfigError, callPlannerModel } from './anthropicClient';

const ORIGINAL_ENV = process.env.ANTHROPIC_API_KEY;

afterEach(() => {
  process.env.ANTHROPIC_API_KEY = ORIGINAL_ENV;
  vi.unstubAllGlobals();
});

describe('callPlannerModel', () => {
  test('throws AnthropicConfigError when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(callPlannerModel('system', [])).rejects.toBeInstanceOf(AnthropicConfigError);
  });

  test('sends the system prompt and history, and returns the response text', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: '{"message":"hi"}' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callPlannerModel('system prompt', [{ role: 'user', content: 'hello' }]);

    expect(result).toBe('{"message":"hi"}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('test-key');
    const body = JSON.parse(init.body);
    expect(body.system).toBe('system prompt');
    expect(body.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });

  test('throws when the Anthropic API responds with a non-ok status', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(callPlannerModel('system', [])).rejects.toThrow('Anthropic API error: 500');
  });

  test('throws when the response has no text content', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: [] }) }));
    await expect(callPlannerModel('system', [])).rejects.toThrow('no text content');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/anthropicClient.test.ts`
Expected: FAIL — `Cannot find module './anthropicClient'`

- [ ] **Step 3: Write the implementation**

Create `lib/ai/anthropicClient.ts`:

```typescript
// SIMPLICITY NOTE: calls the Anthropic Messages API directly via fetch instead
// of adding the @anthropic-ai/sdk dependency — same zero-extra-dependency
// posture this repo already uses for crypto (native Web Crypto over an
// external lib). One JSON request, one JSON response; no streaming.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export class AnthropicConfigError extends Error {}

export async function callPlannerModel(systemPrompt: string, history: ChatTurn[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicConfigError('ANTHROPIC_API_KEY is not set');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: history,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('Anthropic API response had no text content');
  }
  return text;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/anthropicClient.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/ai/anthropicClient.ts lib/ai/anthropicClient.test.ts
git commit -m "feat: add fetch-based Anthropic client for the AI Planner route"
```

---

### Task 8: `/api/ai/plan` route handler

**Files:**
- Create: `app/api/ai/plan/route.ts`
- Test: `app/api/ai/plan/route.test.ts`

**Interfaces:**
- Consumes: `checkRateLimit` (Task 2), `callPlannerModel`, `AnthropicConfigError`, `ChatTurn` (Task 7), `parsePlannerResponse` (Task 4), `PlanContext` (Task 3).
- Produces: `POST` handler at `/api/ai/plan` returning `AIPlannerResponse` JSON — consumed by Task 14 (planner page, via `fetch('/api/ai/plan')`).

- [ ] **Step 1: Write the failing test**

Create `app/api/ai/plan/route.test.ts`:

```typescript
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { _resetRateLimitForTests } from '@/lib/ai/rateLimit';

const callPlannerModelMock = vi.fn();
vi.mock('@/lib/ai/anthropicClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/anthropicClient')>('@/lib/ai/anthropicClient');
  return { ...actual, callPlannerModel: callPlannerModelMock };
});

import { POST } from './route';

function makeRequest(body: unknown, ip = '9.9.9.9'): NextRequest {
  return new NextRequest('http://localhost/api/ai/plan', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const minimalContext = { periodStart: 0, periodEnd: 1, categorySummaries: [], budgets: [], goals: [] };

beforeEach(() => {
  _resetRateLimitForTests();
  callPlannerModelMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/ai/plan', () => {
  test('returns the parsed planner response on success', async () => {
    callPlannerModelMock.mockResolvedValue(JSON.stringify({ message: 'Looking good!' }));

    const res = await POST(makeRequest({ context: minimalContext, message: 'how am I doing?', history: [] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ message: 'Looking good!', proposedPlan: undefined });
  });

  test('returns 429 once the per-IP rate limit is exceeded', async () => {
    callPlannerModelMock.mockResolvedValue(JSON.stringify({ message: 'ok' }));
    for (let i = 0; i < 10; i++) {
      await POST(makeRequest({ context: minimalContext, message: 'hi', history: [] }, '1.1.1.1'));
    }
    const res = await POST(makeRequest({ context: minimalContext, message: 'hi', history: [] }, '1.1.1.1'));
    expect(res.status).toBe(429);
  });

  test('returns 500 with a safe message when the API key is missing', async () => {
    const { AnthropicConfigError } = await import('@/lib/ai/anthropicClient');
    callPlannerModelMock.mockRejectedValue(new AnthropicConfigError('missing'));

    const res = await POST(makeRequest({ context: minimalContext, message: 'hi', history: [] }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.message).toBe('AI planner is unavailable right now.');
  });

  test('returns 502 with a friendly message on any other Anthropic error', async () => {
    callPlannerModelMock.mockRejectedValue(new Error('boom'));

    const res = await POST(makeRequest({ context: minimalContext, message: 'hi', history: [] }));
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.message).toBe('Something went wrong — try again.');
  });

  test('returns 400 on an invalid request body', async () => {
    const req = new NextRequest('http://localhost/api/ai/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/ai/plan/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Write the implementation**

Create `app/api/ai/plan/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { AnthropicConfigError, callPlannerModel, type ChatTurn } from '@/lib/ai/anthropicClient';
import type { PlanContext } from '@/lib/ai/contextSummary';
import { parsePlannerResponse } from '@/lib/ai/planSchema';
import { checkRateLimit } from '@/lib/ai/rateLimit';

// Node runtime (not edge): the in-memory rate limiter needs module-scope state
// that persists across requests within this server instance.
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are a budgeting assistant inside a local-first personal finance app.
The user's message will be preceded by a JSON spending summary (category totals for the last
90 days, existing budgets, existing goals) — never invented data, use it as ground truth.
Reply with JSON only, no markdown code fences, no commentary outside the JSON, matching exactly
this shape:
{"message": "<conversational reply>", "proposedPlan": {"type": "savings_goal" | "budget_adjustment", "goalName": "<string, if proposing a goal>", "targetAmount": <number, if proposing a goal>, "currency": "<ISO 4217 code>", "targetDate": <epoch ms, if proposing a goal>, "budgetAdjustments": [{"categoryId": "<must match a categoryId from the summary>", "suggestedAmount": <number>}]}}
Omit "proposedPlan" entirely when you are not proposing a concrete goal or budget change — most
replies should just be "message". Never invent a categoryId that isn't in the spending summary.`;

interface PlanRequestBody {
  context: PlanContext;
  message: string;
  history: ChatTurn[];
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { message: 'You are sending requests too quickly — try again in a moment.' },
      { status: 429 }
    );
  }

  let body: PlanRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });
  }

  const contextBlock = `Spending summary, budgets, and goals (JSON):\n${JSON.stringify(body.context)}`;
  const history: ChatTurn[] = [
    ...body.history,
    { role: 'user', content: `${contextBlock}\n\nUser message: ${body.message}` },
  ];

  try {
    const raw = await callPlannerModel(SYSTEM_PROMPT, history);
    return NextResponse.json(parsePlannerResponse(raw));
  } catch (err) {
    if (err instanceof AnthropicConfigError) {
      return NextResponse.json({ message: 'AI planner is unavailable right now.' }, { status: 500 });
    }
    return NextResponse.json({ message: 'Something went wrong — try again.' }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/ai/plan/route.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/ai/plan/route.ts app/api/ai/plan/route.test.ts
git commit -m "feat: add stateless /api/ai/plan route with rate limiting"
```

---

### Task 9: Add the Planner link to navigation

**Files:**
- Modify: `components/ui/AppNav.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: a `/planner` nav entry visible in both the top strip and bottom tab bar — consumed visually once Task 14 creates `app/(app)/planner/page.tsx` (until then the link 404s, which is fine mid-implementation since it's all one branch).

- [ ] **Step 1: Edit the imports and `LINKS` array**

In `components/ui/AppNav.tsx`, change:

```typescript
import { LayoutDashboard, Wallet, Repeat, Target } from 'lucide-react';
```

to:

```typescript
import { LayoutDashboard, Wallet, Repeat, Target, Sparkles } from 'lucide-react';
```

Change:

```typescript
const LINKS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/budgets', label: 'Budgets', icon: Wallet },
  { href: '/recurring', label: 'Recurring', icon: Repeat },
  { href: '/goals', label: 'Goals', icon: Target },
] as const;
```

to:

```typescript
const LINKS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/budgets', label: 'Budgets', icon: Wallet },
  { href: '/recurring', label: 'Recurring', icon: Repeat },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/planner', label: 'Planner', icon: Sparkles },
] as const;
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/AppNav.tsx
git commit -m "feat: add Planner link to app navigation"
```

---

### Task 10: `ChatPanel` component

**Files:**
- Create: `components/planner/ChatPanel.tsx`

**Interfaces:**
- Consumes: `ProposedPlan` type from `lib/ai/planSchema.ts` (Task 4) for the `proposedPlan` field on a message — purely for typing, not rendered here (Task 14 renders `PlanConfirmCard` separately for the latest pending proposal).
- Produces: `ChatMessage` type (`{ id: string; role: 'user' | 'assistant'; content: string }`), `ChatPanel` component with props `{ messages: ChatMessage[]; onSend: (text: string) => void; sending: boolean }` — consumed by Task 14 (planner page).

- [ ] **Step 1: Write the component**

Create `components/planner/ChatPanel.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { fieldClass, primaryButton } from '@/components/ui/controls';

// SIMPLICITY NOTE: chat history is session-only React state, not persisted to
// IndexedDB (see AI Planner design spec "Chat history"). It resets on reload or
// profile switch — the artifact that matters (the tracked goal/budget) persists
// separately via TrackedPlanWidget, so this is an accepted simplicity tradeoff.
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function ChatPanel({
  messages,
  onSend,
  sending,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  sending: boolean;
}) {
  const [draft, setDraft] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setDraft('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
        {messages.length === 0 && (
          <p className="text-body text-muted">
            Tell me a savings goal or ask how your budgets are doing — for example, "I want to save
            10 million rupiah this month."
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-callout px-3 py-2 text-body ${
              m.role === 'user' ? 'ml-auto bg-accent text-accent-foreground' : 'bg-background text-foreground'
            }`}
          >
            {m.content}
          </div>
        ))}
        {sending && <p className="text-label text-muted">Thinking…</p>}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className={`flex-1 ${fieldClass}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask the planner…"
          disabled={sending}
          aria-label="Message"
        />
        <button type="submit" className={primaryButton} disabled={sending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/planner/ChatPanel.tsx
git commit -m "feat: add planner ChatPanel component"
```

---

### Task 11: `PlanConfirmCard` component

**Files:**
- Create: `components/planner/PlanConfirmCard.tsx`

**Interfaces:**
- Consumes: `ProposedPlan` from `lib/ai/planSchema.ts` (Task 4).
- Produces: `ConfirmedSelection` type (`{ goal: boolean; budgetAdjustmentIndexes: number[] }`), `PlanConfirmCard` component with props `{ plan: ProposedPlan; categoryNameById: Map<string, string>; onConfirm: (selection: ConfirmedSelection) => void; onDismiss: () => void }` — consumed by Task 14 (planner page).

- [ ] **Step 1: Write the component**

Create `components/planner/PlanConfirmCard.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { ProposedPlan } from '@/lib/ai/planSchema';
import { formatMoney } from '@/lib/finance/format';
import { primaryButton, secondaryButton } from '@/components/ui/controls';

export interface ConfirmedSelection {
  goal: boolean;
  budgetAdjustmentIndexes: number[];
}

// Never auto-write an AI-proposed plan (CLAUDE.md / DESIGN.md "Confirm before
// the AI touches real data"): every goal and every budget-adjustment line has
// its own checkbox, default-checked, so the user can deselect individual lines
// before anything is written to the local DB.
export function PlanConfirmCard({
  plan,
  categoryNameById,
  onConfirm,
  onDismiss,
}: {
  plan: ProposedPlan;
  categoryNameById: Map<string, string>;
  onConfirm: (selection: ConfirmedSelection) => void;
  onDismiss: () => void;
}) {
  const hasGoal = plan.type === 'savings_goal' && Boolean(plan.goalName) && plan.targetAmount !== undefined;
  const adjustments = plan.budgetAdjustments ?? [];

  const [goalChecked, setGoalChecked] = useState(hasGoal);
  const [adjustmentChecked, setAdjustmentChecked] = useState<boolean[]>(adjustments.map(() => true));

  function toggleAdjustment(index: number) {
    setAdjustmentChecked((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }

  function handleConfirm() {
    onConfirm({
      goal: hasGoal && goalChecked,
      budgetAdjustmentIndexes: adjustmentChecked.flatMap((checked, i) => (checked ? [i] : [])),
    });
  }

  const nothingSelected = !(hasGoal && goalChecked) && !adjustmentChecked.some(Boolean);

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
      <h2 className="text-title text-foreground">Proposed plan</h2>

      {hasGoal && (
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={goalChecked}
            onChange={(e) => setGoalChecked(e.target.checked)}
            className="mt-1"
          />
          <span className="text-body text-foreground">
            New goal: <strong>{plan.goalName}</strong> —{' '}
            {formatMoney(plan.currency ?? '', plan.targetAmount ?? 0)}
            {plan.targetDate ? ` by ${new Date(plan.targetDate).toLocaleDateString()}` : ''}
          </span>
        </label>
      )}

      {adjustments.map((adj, i) => (
        <label key={`${adj.categoryId}-${i}`} className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={adjustmentChecked[i]}
            onChange={() => toggleAdjustment(i)}
            className="mt-1"
          />
          <span className="text-body text-foreground">
            Set {categoryNameById.get(adj.categoryId) ?? adj.categoryId} budget to{' '}
            <strong>{adj.suggestedAmount.toLocaleString()}</strong>
          </span>
        </label>
      ))}

      <div className="flex gap-2">
        <button type="button" className={primaryButton} onClick={handleConfirm} disabled={nothingSelected}>
          Confirm
        </button>
        <button type="button" className={secondaryButton} onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/planner/PlanConfirmCard.tsx
git commit -m "feat: add PlanConfirmCard with line-item confirm before any DB write"
```

---

### Task 12: `TrackedPlanWidget` component

**Files:**
- Create: `components/planner/TrackedPlanWidget.tsx`

**Interfaces:**
- Consumes: `findLatestPlanBatch` (Task 5), `goalProgress`, `requiredDailyPace` (Task 6 / existing `lib/finance/calculations.ts`), `formatMoney` (existing `lib/finance/format.ts`).
- Produces: `TrackedPlanWidget` component with props `{ goals: Goal[]; budgets: Budget[]; transactions: Transaction[]; categoryNameById: Map<string, string> }` — consumed by Task 14 (planner page). Renders nothing (`null`) when there is no AI plan batch yet.

- [ ] **Step 1: Write the component**

Create `components/planner/TrackedPlanWidget.tsx`:

```typescript
'use client';

import type { Budget, Goal, Transaction } from '@/lib/db/schema';
import { findLatestPlanBatch } from '@/lib/ai/planBatch';
import { goalProgress, requiredDailyPace } from '@/lib/finance/calculations';
import { formatMoney } from '@/lib/finance/format';

function daysRemaining(targetDate: number, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((targetDate - now) / 86_400_000));
}

// Reads live from the local DB via the goals/budgets/transactions already
// fetched by the parent page's useLiveQuery hooks — never a snapshot frozen at
// plan-creation time (PRD Section 6.3 / DESIGN.md "Live progress over static
// snapshots").
export function TrackedPlanWidget({
  goals,
  budgets,
  transactions,
  categoryNameById,
}: {
  goals: Goal[];
  budgets: Budget[];
  transactions: Transaction[];
  categoryNameById: Map<string, string>;
}) {
  const batch = findLatestPlanBatch(goals, budgets);
  if (!batch) return null;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
      <h2 className="text-title text-foreground">Tracked plan</h2>

      {batch.goal && (
        <GoalProgress goal={batch.goal} transactions={transactions} />
      )}

      {batch.budgets.length > 0 && (
        <ul className="flex flex-col gap-2">
          {batch.budgets.map((b) => (
            <li key={b.id} className="text-body text-foreground">
              {categoryNameById.get(b.categoryId) ?? b.categoryId}:{' '}
              <span className="tabular-nums">{formatMoney(b.currency, b.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GoalProgress({ goal, transactions }: { goal: Goal; transactions: Transaction[] }) {
  const progress = goalProgress(goal, transactions);
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((progress / goal.targetAmount) * 100)) : 0;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-body text-foreground">{goal.name}</p>
      <div className="h-2 w-full rounded-full bg-background">
        <div
          className="h-2 rounded-full bg-accent transition-[width] duration-150 ease-out-quart motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-label text-muted tabular-nums">
        {formatMoney(goal.currency, progress)} of {formatMoney(goal.currency, goal.targetAmount)}
      </p>
      {goal.targetDate && (
        <p className="text-label text-muted">
          {daysRemaining(goal.targetDate)} days left — need{' '}
          <span className="tabular-nums">
            {formatMoney(goal.currency, requiredDailyPace(goal.targetAmount, progress, goal.targetDate))}
          </span>{' '}
          /day to hit it
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/planner/TrackedPlanWidget.tsx
git commit -m "feat: add TrackedPlanWidget reading live from Dexie"
```

---

### Task 13: `SuggestionCallout` component

**Files:**
- Create: `components/planner/SuggestionCallout.tsx`

**Interfaces:**
- Consumes: nothing project-specific beyond `secondaryButton` from `components/ui/controls.ts`.
- Produces: `SuggestionCallout` component with props `{ suggestion: string | null; onRefresh: () => void; canRefreshAt: number; loading: boolean }` — consumed by Task 14 (planner page, which owns the localStorage debounce timestamp and passes `canRefreshAt` down).

- [ ] **Step 1: Write the component**

Create `components/planner/SuggestionCallout.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { secondaryButton } from '@/components/ui/controls';

// PRD Section 6.4: proactive suggestions are a manual, debounced refresh, never
// an automatic call on every transaction/render. The page owns the actual
// once-per-hour gate (via localStorage); this component just disables the
// button and shows when it'll be available again.
export function SuggestionCallout({
  suggestion,
  onRefresh,
  canRefreshAt,
  loading,
}: {
  suggestion: string | null;
  onRefresh: () => void;
  canRefreshAt: number;
  loading: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const canRefresh = now >= canRefreshAt;

  return (
    <div className="flex flex-col gap-3 rounded-callout border border-border bg-surface p-4">
      <p className="text-body text-foreground">
        {suggestion ?? 'Get a concrete suggestion based on your current progress.'}
      </p>
      <button
        type="button"
        className={`${secondaryButton} self-start`}
        onClick={onRefresh}
        disabled={!canRefresh || loading}
      >
        {loading
          ? 'Thinking…'
          : canRefresh
            ? 'Get updated suggestion'
            : `Next refresh at ${new Date(canRefreshAt).toLocaleTimeString()}`}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/planner/SuggestionCallout.tsx
git commit -m "feat: add SuggestionCallout with manual debounced refresh"
```

---

### Task 14: Planner page — wire everything together

**Files:**
- Create: `app/(app)/planner/page.tsx`

**Interfaces:**
- Consumes: `useVault` (existing `lib/vault/VaultContext.tsx`), `db` (existing `lib/db/db.ts`), `listTransactions` (existing `lib/db/transactions.ts`), `goals as goalStore` (existing `lib/db/goals.ts`), `budgets as budgetStore` (existing `lib/db/budgets.ts`), `buildPlanContext` (Task 3), `ChatPanel`/`ChatMessage` (Task 10), `PlanConfirmCard`/`ConfirmedSelection` (Task 11), `TrackedPlanWidget` (Task 12), `SuggestionCallout` (Task 13), `ProposedPlan`/`AIPlannerResponse` (Task 4).
- Produces: the `/planner` route. Nothing else depends on this file.

- [ ] **Step 1: Write the page**

Create `app/(app)/planner/page.tsx`:

```typescript
'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVault } from '@/lib/vault/VaultContext';
import { db } from '@/lib/db/db';
import type { Budget, Goal } from '@/lib/db/schema';
import { listTransactions } from '@/lib/db/transactions';
import { goals as goalStore } from '@/lib/db/goals';
import { budgets as budgetStore } from '@/lib/db/budgets';
import { buildPlanContext } from '@/lib/ai/contextSummary';
import type { AIPlannerResponse, ProposedPlan } from '@/lib/ai/planSchema';
import type { ChatTurn } from '@/lib/ai/anthropicClient';
import { ChatPanel, type ChatMessage } from '@/components/planner/ChatPanel';
import { PlanConfirmCard, type ConfirmedSelection } from '@/components/planner/PlanConfirmCard';
import { TrackedPlanWidget } from '@/components/planner/TrackedPlanWidget';
import { SuggestionCallout } from '@/components/planner/SuggestionCallout';

const SUGGESTION_COOLDOWN_MS = 60 * 60 * 1000;

function suggestionStorageKey(profileId: string): string {
  return `planner-suggestion-cooldown-${profileId}`;
}

// Picks the currency to use for a confirmed budget-adjustment line: the
// existing budget's currency if one is already set for that category, else the
// currency the category has actually been spending in (most expense first),
// else the goal's currency, else IDR — there is no auto currency conversion in
// this app (PRD 5.7), so a brand-new category with no history and no proposed
// goal currency has nothing reliable to infer from and falls back to IDR.
function resolveCurrencyForCategory(
  categoryId: string,
  existingBudgets: Budget[],
  context: ReturnType<typeof buildPlanContext>,
  fallbackCurrency?: string
): string {
  const existing = existingBudgets.find((b) => b.categoryId === categoryId);
  if (existing) return existing.currency;

  const summaries = context.categorySummaries.filter((c) => c.categoryId === categoryId);
  const byExpense = summaries.sort((a, b) => b.expense - a.expense)[0];
  if (byExpense) return byExpense.currency;

  return fallbackCurrency ?? 'IDR';
}

export default function PlannerPage() {
  const { activeProfile, vaultKey } = useVault();
  const profileId = activeProfile!.id;
  const key = vaultKey!;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingPlan, setPendingPlan] = useState<ProposedPlan | null>(null);
  const [sending, setSending] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [canRefreshAt, setCanRefreshAt] = useState(() => {
    const stored = localStorage.getItem(suggestionStorageKey(profileId));
    return stored ? Number(stored) : 0;
  });

  const categories = useLiveQuery(
    () => db.categories.where('profileId').equals(profileId).toArray(),
    [profileId]
  );
  const transactions = useLiveQuery(() => listTransactions(db, key, profileId), [profileId, key]) ?? [];
  const goals = useLiveQuery(() => goalStore.list(db, key, profileId), [profileId, key]) ?? [];
  const budgets = useLiveQuery(() => budgetStore.list(db, key, profileId), [profileId, key]) ?? [];

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories ?? []) map.set(c.id, c.name);
    return map;
  }, [categories]);

  async function callPlanApi(message: string, history: ChatTurn[]): Promise<AIPlannerResponse> {
    const context = buildPlanContext(transactions, budgets, goals);
    const response = await fetch('/api/ai/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ context, message, history }),
    });
    return response.json();
  }

  async function handleSend(text: string) {
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    const history: ChatTurn[] = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const result = await callPlanApi(text, history);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: result.message }]);
      if (result.proposedPlan) setPendingPlan(result.proposedPlan);
    } catch {
      // Network failure on the client fetch: show an inline error in the
      // transcript instead of losing the rest of the conversation or leaving
      // `sending` stuck — the user can just retype their message.
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: "Couldn't reach the planner — try again." },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function handleConfirmPlan(selection: ConfirmedSelection) {
    if (!pendingPlan) return;
    const batchId = crypto.randomUUID();
    const context = buildPlanContext(transactions, budgets, goals);

    if (selection.goal && pendingPlan.goalName && pendingPlan.targetAmount !== undefined) {
      await goalStore.add(db, key, profileId, {
        name: pendingPlan.goalName,
        type: 'savings',
        targetAmount: pendingPlan.targetAmount,
        currentAmount: 0,
        currency: pendingPlan.currency ?? 'IDR',
        targetDate: pendingPlan.targetDate,
        aiPlanBatchId: batchId,
      });
    }

    const adjustments = pendingPlan.budgetAdjustments ?? [];
    for (const index of selection.budgetAdjustmentIndexes) {
      const adjustment = adjustments[index];
      const existing = budgets.find((b) => b.categoryId === adjustment.categoryId);
      const currency = resolveCurrencyForCategory(adjustment.categoryId, budgets, context, pendingPlan.currency);

      if (existing) {
        await budgetStore.update(db, key, existing.id, {
          amount: adjustment.suggestedAmount,
          aiPlanBatchId: batchId,
        });
      } else {
        await budgetStore.add(db, key, profileId, {
          categoryId: adjustment.categoryId,
          amount: adjustment.suggestedAmount,
          currency,
          period: 'monthly',
          alertThresholdPct: 80,
          aiPlanBatchId: batchId,
        });
      }
    }

    setPendingPlan(null);
  }

  async function handleRefreshSuggestion() {
    setSuggestionLoading(true);
    try {
      const result = await callPlanApi(
        'Given my current progress, suggest 1-2 concrete actions I should take next.',
        []
      );
      setSuggestion(result.message);
      const nextAt = Date.now() + SUGGESTION_COOLDOWN_MS;
      setCanRefreshAt(nextAt);
      localStorage.setItem(suggestionStorageKey(profileId), String(nextAt));
    } catch {
      setSuggestion("Couldn't reach the planner — try again.");
    } finally {
      setSuggestionLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-title text-foreground">Planner</h1>

      <TrackedPlanWidget
        goals={goals as Goal[]}
        budgets={budgets as Budget[]}
        transactions={transactions}
        categoryNameById={categoryNameById}
      />

      <SuggestionCallout
        suggestion={suggestion}
        onRefresh={handleRefreshSuggestion}
        canRefreshAt={canRefreshAt}
        loading={suggestionLoading}
      />

      {pendingPlan && (
        <PlanConfirmCard
          plan={pendingPlan}
          categoryNameById={categoryNameById}
          onConfirm={handleConfirmPlan}
          onDismiss={() => setPendingPlan(null)}
        />
      )}

      <ChatPanel messages={messages} onSend={handleSend} sending={sending} />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, set `ANTHROPIC_API_KEY` in `.env.local`, visit `/planner`, send "I want to save 5 million rupiah by the end of next month." Confirm:
- A chat reply appears.
- If a plan is proposed, `PlanConfirmCard` shows with checkboxes, nothing is written until "Confirm" is clicked.
- After confirming, `TrackedPlanWidget` shows the goal with a progress bar.
- Reload the page — `TrackedPlanWidget` still shows the same plan (proves it's reading from the DB, not session state); the chat transcript is empty again (proves chat history is session-only, as designed).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/planner/page.tsx"
git commit -m "feat: wire up the AI Planner page (chat, confirm, tracked widget, suggestions)"
```

---

### Task 15: Update project docs for Phase 3

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update the project status line**

In `CLAUDE.md`, change:

```markdown
Phases 1–2 are implemented — Phase 1 (local vault + core transaction tracking) and Phase 2 (budget envelopes, recurring rules with lazy on-load generation, goals, derived net worth). See `app/`, `lib/`, and `components/`. Build/lint/test commands:
```

to:

```markdown
Phases 1–3 are implemented — Phase 1 (local vault + core transaction tracking), Phase 2 (budget envelopes, recurring rules with lazy on-load generation, goals, derived net worth), and Phase 3 (AI planner chat, stateless `/api/ai/plan` route, tracked-plan widget). See `app/`, `lib/`, and `components/`. Build/lint/test commands:
```

And change:

```markdown
No environment variables are required yet. Phase 3 (AI planner) will need `ANTHROPIC_API_KEY`; Phase 6 (cloud backup) will need Supabase keys — none of that exists yet, do not add API routes or env var reads until those phases start.
```

to:

```markdown
`ANTHROPIC_API_KEY` is required for the AI planner (`/api/ai/plan`) — set it in `.env.local`, never commit it. Phase 6 (cloud backup) will need Supabase keys — that phase hasn't started yet, do not add Supabase imports or env var reads until it does.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 3 (AI Planner) as implemented"
```

---

## Final verification

- [ ] Run: `npm test` — all suites pass, including the new `lib/ai/*.test.ts` and `app/api/ai/plan/route.test.ts` files.
- [ ] Run: `npm run typecheck` — no errors.
- [ ] Run: `npm run lint` — no errors.
- [ ] Manually verify the `/planner` page per Task 14 Step 3 with a real `ANTHROPIC_API_KEY`.
