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
