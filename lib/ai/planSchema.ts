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

// Strips a leading/trailing markdown code fence. Each side is stripped
// independently (not one matched pair) because a truncated model response —
// cut off by the token limit before it could close its fence — has an opening
// ```json with no closing ``` at all; requiring both would leave the fence
// markers in the text that falls through to the fail-open path below.
function stripCodeFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
}

// Best-effort recovery of the "message" field's string value when the
// response isn't valid JSON at all — typically because it was truncated
// mid-string (no closing quote) or mid-object (no closing brace). Without
// this, a truncated reply renders as a raw, half-finished JSON blob instead of
// the readable prose the model was actually writing.
function extractMessageFallback(text: string): string | null {
  const match = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    // The captured text itself ends mid-escape-sequence (e.g. a dangling
    // backslash) — return it as-is rather than the original fenced/JSON text.
    return match[1];
  }
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
  const recoveredMessage = extractMessageFallback(candidate);
  return { message: recoveredMessage ?? raw, proposedPlan: undefined };
}
