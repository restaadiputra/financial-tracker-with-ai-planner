# Design: Phase 3 — AI Planner

**Date:** 2026-06-21
**Status:** Approved
**Builds on:** Phase 2 (budgets, recurring rules, goals, net worth)

## Summary

Implements PRD Section 6 / Section 12 Phase 3: a chat UI that turns a stated
goal ("save 10 million rupiah this month") into a trackable `Goal`/`Budget`
artifact, plus a persistent dashboard-style widget that tracks real progress
against it, and a manual/debounced proactive-suggestion refresh. The AI never
gets server-side DB access — client gathers context, server is a stateless
proxy to Anthropic, client confirms before any write.

## Architecture

```
app/
  api/ai/plan/route.ts        # stateless POST, Node runtime, no DB access
  (app)/planner/page.tsx      # chat + tracked widget + suggestion callout
lib/
  ai/
    anthropicClient.ts        # thin Anthropic SDK wrapper, reads ANTHROPIC_API_KEY
    rateLimit.ts              # in-memory per-IP limiter
    contextSummary.ts         # builds compact spending/budget/goal summary
    planSchema.ts             # parse + validate AIPlannerResponse from model text
    types.ts                  # AIPlannerResponse, PlanContext shared types
components/
  planner/
    ChatPanel.tsx             # message list + input, session-only state
    PlanConfirmCard.tsx       # checkbox-per-line confirm before any DB write
    TrackedPlanWidget.tsx     # useLiveQuery widget for latest AI plan batch
    SuggestionCallout.tsx     # manual "Get updated suggestion" (1/hr debounce)
components/ui/AppNav.tsx      # add 5th link: Planner
lib/db/schema.ts              # add optional aiPlanBatchId to Goal and Budget
```

## Data flow (per PRD Section 6.1)

1. User types a message in `ChatPanel`.
2. Client builds a `PlanContext` via `contextSummary.ts` — **not** a raw
   transaction dump. Aggregates the active profile's last 90 days of
   decrypted transactions into per-category income/expense totals, plus
   existing `Budget`/`Goal` records (decrypted client-side, as already done
   throughout this app). `SIMPLICITY NOTE`: sending aggregates instead of raw
   transactions is smaller, cheaper, and leaks less detail to the API call,
   at the cost of the AI not seeing individual transaction notes/merchants —
   acceptable since planning advice operates at the category-total level.
3. Client POSTs `{ context, message, history }` to `/api/ai/plan`.
   `history` is the in-memory chat transcript for this session only (see
   "Chat history" below) — no chat persistence table.
4. Route checks rate limit (per-IP), calls Anthropic with a system prompt
   instructing JSON-only output matching `AIPlannerResponse`, returns the
   parsed result. Writes nothing to any DB. No request/response logging.
5. Client renders `message` in the chat transcript. If `proposedPlan` is
   present, renders `PlanConfirmCard` instead of auto-saving.
6. User reviews `PlanConfirmCard`: each proposed budget adjustment line and
   the proposed goal (if present) has its own checkbox, default checked.
   "Confirm" writes only the checked lines; "Dismiss" discards everything.
   Confirming never partially happens without this screen.

## Linking AI output to the tracked widget

PRD wants a persistent widget reading live from the DB, not a snapshot taken
at creation time, and it needs to know which `Goal`/`Budget` came from the
most recent confirmed AI plan (as opposed to ones the user created/edited
manually). Rather than a new table, add one optional field to existing
decrypted shapes:

```typescript
interface Goal {
  // ...existing fields
  aiPlanBatchId?: string; // set when created via a confirmed AI plan
}
interface Budget {
  // ...existing fields
  aiPlanBatchId?: string;
}
```

On confirm, the client generates one `crypto.randomUUID()` batch id and
stamps it onto whichever lines the user kept checked (goal and/or budget
adjustments from that single confirm action). `TrackedPlanWidget` queries
the active profile's goals/budgets via `useLiveQuery`, finds the most recent
distinct `aiPlanBatchId` (by `createdAt`), and renders that batch's goal
progress bar + days remaining + required pace, plus any budget adjustments
in the same batch. This persists across reloads (unlike the chat transcript)
because it lives in the existing encrypted `Goal`/`Budget` tables.

If the user later edits a goal/budget manually, it keeps its
`aiPlanBatchId` (provenance, not a lock) — editing doesn't need to clear it.

## Chat history

Decision: **session-only**, not persisted. `ChatPanel` holds the transcript
in React state; it resets on reload or profile switch. This is a deliberate
deviation from the PRD's `aiChatHistory` table suggestion, made explicitly
to avoid the added complexity of another encrypted table for what is, in
this app's actual usage pattern, a short-lived planning conversation — the
artifact that matters (the tracked goal/budget) already persists via the
mechanism above. `SIMPLICITY NOTE` comment in `ChatPanel.tsx`.

## Structured output parsing

`planSchema.ts` parses the model's raw text response:

1. Strip a leading/trailing markdown code fence if present (models
   occasionally wrap JSON in ```` ```json ```` even when told not to).
2. `JSON.parse` the result.
3. Validate against the `AIPlannerResponse` shape (message: string required;
   proposedPlan optional, and if present, validate its sub-fields loosely —
   e.g. `budgetAdjustments` must be an array of `{categoryId, suggestedAmount}`).
4. On any failure (invalid JSON, wrong shape), **fail open**: treat the raw
   text as `message` with no `proposedPlan`, rather than erroring the whole
   request. The chat still shows something instead of breaking.

## Rate limiting

`lib/ai/rateLimit.ts`: a module-scope `Map<string, { count: number; windowStart: number }>` keyed by request IP (from `x-forwarded-for` / connection
remote addr), fixed window, e.g. 10 requests/minute. Returns 429 with a
plain-language message when exceeded. `SIMPLICITY NOTE`: resets on server
restart and doesn't share state across instances — acceptable per PRD
Section 6.5 for a single-instance personal/small-scale deployment; revisit
with Redis-backed limiting only if this app gets multi-instance traffic.

## Proactive suggestions (PRD Section 6.4)

`SuggestionCallout` renders near `TrackedPlanWidget`, separate from the chat
transcript. "Get updated suggestion" button calls `/api/ai/plan` with the
current tracked-plan progress as context and a system instruction asking for
1-2 concrete actions, no free-form chat message. Client-side debounce: a
`localStorage` timestamp per profile, button disabled with a "next refresh
available at HH:MM" hint if called within the last hour. No server-side
cron/scheduling.

## Anthropic model choice

Use `claude-haiku-4-5` by default for both the chat and suggestion calls —
budgeting advice from category-aggregated context doesn't need a larger
model, and it keeps per-call cost predictable per PRD Section 6.5. Model
name is a single constant in `anthropicClient.ts`, not hardcoded at each
call site, so it's a one-line change if Resta wants to upgrade later.

## Error handling

- Missing `ANTHROPIC_API_KEY`: route returns 500 with a generic
  "AI planner is unavailable right now" message — never leaks env/config
  details to the client.
- Anthropic API error (timeout, 4xx/5xx from Anthropic): route catches,
  returns a friendly message field client can render as a chat bubble
  ("Something went wrong — try again"), not a thrown error that breaks the
  chat UI.
- Network failure on the client fetch: `ChatPanel` shows an inline retry
  affordance on that message, doesn't lose the rest of the transcript.

## Testing

Vitest unit tests (matching this repo's existing pattern of testing `lib/`,
not routes/components):

- `lib/ai/rateLimit.test.ts` — window reset, per-key isolation, limit boundary.
- `lib/ai/contextSummary.test.ts` — category aggregation correctness, 90-day
  cutoff boundary, multi-currency totals stay separate (no blending).
- `lib/ai/planSchema.test.ts` — valid JSON parses correctly; JSON wrapped in
  a markdown fence parses correctly; malformed JSON and wrong-shape JSON
  both fail open to a plain message with no `proposedPlan`.

The route handler itself isn't unit tested directly (would require mocking
the Anthropic SDK end-to-end for low marginal value); its two pieces of real
logic — rate limiting and parsing — are tested directly above. Manual
verification of the live route happens via `npm run dev` + a real
`ANTHROPIC_API_KEY` during implementation review.

## Out of scope (this phase)

- No `aiChatHistory` persistence (see "Chat history" above).
- No streaming responses — a single request/response per chat turn.
- No multi-turn function-calling / tool use on the Anthropic side — one
  structured-JSON response per call, per PRD Section 6.2.
- Receipt scanning (Phase 4) — untouched.
