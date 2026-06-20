# Product

## Register

product

## Users

Privacy-conscious individuals, primarily Indonesia-based (freelancers, individuals managing IDR and sometimes USD income), who want a personal finance tracker that keeps their financial data entirely on their own device. They're using this for day-to-day workflows: logging transactions, checking budget envelopes, scanning receipts, chatting with the AI planner about a savings goal, and occasionally exporting/restoring a backup. They care about control over their data as much as the tracking itself — "login" here is an honest local-vault unlock, not theater, and the product should never undercut that trust.

## Product Purpose

A local-first personal finance tracker with an AI planner: transactions, budgets, recurring rules, and goals all live encrypted in the browser (IndexedDB via Dexie), with no server database for financial records in the Free tier. An AI chat feature turns a stated goal ("save 10 million rupiah this month") into a trackable budget plan that updates live against real spending, plus an optional receipt-scanning flow. A paid Pro tier adds manual, user-initiated encrypted cloud backup (Supabase Storage blob only, never structured server data). Success looks like a user trusting the app enough to track their real finances daily, and the AI planner producing concrete, confirmable suggestions rather than just chat.

## Brand Personality

Friendly, encouraging, approachable — closer to a personal coach than a bank statement. Borrow the soft, card-based, progress-bar-driven warmth of Mint/Monarch-style budgeting apps for the day-to-day surfaces (dashboard, budgets, goals, planner). For the vault/security-sensitive surfaces (profile picker, unlock, backup/restore), lean on plain, honest, reassuring copy and a calmer visual register — the same spirit Bitwarden/Standard Notes bring to "we don't have your password and can't recover it for you," stated supportively rather than as a legal disclaimer.

## Anti-references

- Generic corporate fintech: navy-and-gold palettes, stock photography, anything that reads like a bank or insurance brochure. Too cold and impersonal for a personal, friendly tool.
- Cold spreadsheet/accounting software: dense Excel-like tables, sterile forms, no visual breathing room. This is not double-entry bookkeeping software and shouldn't look like it.

## Design Principles

- **Honest about the vault, warm about the money.** Security/local-vault copy and flows should be plain and reassuring, never buried in legal-speak; everyday tracking surfaces should feel encouraging, not punitive, even when a budget is overspent.
- **Confirm before the AI touches real data.** Every AI-proposed plan, budget adjustment, or receipt extraction is a suggestion shown for review, never an auto-write — the UI must always make the confirm step feel like a natural part of the flow, not friction bolted on.
- **Live progress over static snapshots.** Goal/budget widgets read live from the local DB; design them to feel alive and responsive to a transaction just logged, not like a report generated once and left stale.
- **Per-currency clarity, not blended illusion.** Since there's no auto currency conversion, totals and progress must be visually and textually clear about which currency they represent — never imply a single blended number that doesn't exist.
- **Simple beats clever, visually too.** Where the PRD calls a `SIMPLICITY NOTE` tradeoff (e.g. manual goal progress, monthly-only budgets), the UI should embrace that simplicity rather than dress it up as more sophisticated than it is.

## Accessibility & Inclusion

Standard WCAG AA: body text ≥4.5:1 contrast, large text ≥3:1, visible keyboard focus states, full keyboard navigation, and `prefers-reduced-motion` alternatives for all motion (especially progress-bar and chart animations on the dashboard/goals views).
