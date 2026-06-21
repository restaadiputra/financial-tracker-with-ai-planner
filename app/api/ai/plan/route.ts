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
