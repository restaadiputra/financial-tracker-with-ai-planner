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

  // Resolved currency per categoryId for whatever budget adjustments are
  // currently proposed — computed with the exact same logic handleConfirmPlan
  // uses for the real write, so PlanConfirmCard never shows a currency that
  // could differ from what actually gets saved.
  const categoryCurrencyById = useMemo(() => {
    const map = new Map<string, string>();
    if (!pendingPlan) return map;
    const context = buildPlanContext(transactions, budgets, goals);
    for (const adj of pendingPlan.budgetAdjustments ?? []) {
      map.set(adj.categoryId, resolveCurrencyForCategory(adj.categoryId, budgets, context, pendingPlan.currency));
    }
    return map;
  }, [pendingPlan, transactions, budgets, goals]);

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
          categoryCurrencyById={categoryCurrencyById}
          onConfirm={handleConfirmPlan}
          onDismiss={() => setPendingPlan(null)}
        />
      )}

      <ChatPanel messages={messages} onSend={handleSend} sending={sending} />
    </main>
  );
}
