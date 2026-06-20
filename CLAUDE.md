# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository currently contains only the product spec (`docs/finance-tracker-prd.md`) — no application code has been written yet. There is no package.json, build tooling, or test suite to reference. When code is added, update this file with actual build/lint/test commands.

## What this project is

A local-first personal finance tracker with an AI planner. Target stack: Next.js 15 (App Router) + TypeScript (strict) + Tailwind + Dexie.js (IndexedDB). The full spec, including data models, exact phase-by-phase build prompts, and rationale for every major decision, lives in `docs/finance-tracker-prd.md` — read it before implementing any phase, since the architecture decisions below are load-bearing and explained there in more depth.

## Core principles (do not violate)

1. **No financial data ever touches a server in the Free tier.** All transaction/budget/goal reads/writes are to IndexedDB in the browser, never a backend DB.
2. **Data at rest is encrypted** with a key derived from the user's local password (PBKDF2-SHA256, 210,000+ iterations, AES-GCM 256-bit). This is not optional.
3. **AI features that need a server call (planner chat, receipt OCR) send only the minimum data needed for that single request**, via stateless Next.js API routes that persist nothing server-side as a byproduct of the call — not even logs of the request/response.
4. **Pro/cloud backup is the only feature allowed to touch a real backend** (Supabase Auth + Storage), and even then it only stores an encrypted blob, never structured queryable financial data. No Postgres tables for financial data, ever.
5. **Simplicity first.** Where a feature could be built simple or "more correct but complex," default to simple and mark the tradeoff with a `SIMPLICITY NOTE` comment in code (see the PRD for the canonical list of these tradeoffs — e.g. PBKDF2 over Argon2id, unencrypted `date` field for query performance, no auto currency conversion, monthly-only budget periods).

## Build phases

Phases are meant to be built in order, each independently demoable, with no later-phase server dependency leaking into earlier phases (e.g. Phases 1–5 must have zero Supabase imports):

1. Local vault + core transaction tracking (no server)
2. Budgets, recurring transactions, goals (no server)
3. AI Planner — chat that spawns a tracked budget plan (Anthropic API, stateless calls only)
4. Receipt scanning via AI extraction (Anthropic API, stateless calls only)
5. Manual backup/restore — JSON export/import (no server)
6. Pro tier: cloud backup (Supabase Auth + Storage) — do not start without explicit go-ahead
7. Payment integration for Indonesia, e.g. iPaymu (re-verify onboarding requirements at build time) — do not start without explicit go-ahead

The exact paste-ready prompt for each phase is in PRD Section 12.

## Architecture

### Local vault (multi-profile auth that isn't real server auth)

"Login" is a local vault unlock, not server identity verification. Each profile stores: a random salt, and a `verifier` (a known constant string encrypted with the derived key) used to check password correctness on unlock — AES-GCM's auth tag makes wrong-key decryption fail loudly rather than silently. The derived AES key is held only in a `VaultContext` (React Context) for the session — never persisted to localStorage/cookies. "Switch user" just clears the context and returns to the profile picker; no page reload needed.

### Encrypted-record pattern

Every financial table (`transactions`, `budgets`, `goals`, `recurringRules`, `aiChatHistory`) stores most fields as a single AES-GCM-encrypted `encryptedPayload` blob, plus a few unencrypted fields needed for Dexie indexing/queries without decrypting every record (e.g. `profileId` for scoping, `date` for range queries/sorting). This is a deliberate privacy/performance tradeoff — see PRD Section 4.4.

### AI planner data flow (why it's structured this way)

The AI never has server-side access to financial data. The flow is always: client gathers context from the local decrypted DB → sends (context + message) to a stateless `/api/ai/plan` route → route calls Anthropic and returns a response, writing nothing to any DB → client shows a confirm step before writing any AI-proposed plan/budget to local IndexedDB. Never auto-write AI output to financial records. The tracked-plan dashboard widget reads live from Dexie via `useLiveQuery`, not from a snapshot taken at plan-creation time.

### Receipt scanning data flow

Image goes client → stateless `/api/ai/receipt` route (Claude vision) → structured JSON extraction → route discards the image immediately (no logging, no storage) → client pre-fills a transaction form for user review/edit before any save. Never auto-save a transaction straight from OCR output.

### Recurring transactions

Generated lazily on app load (and once/day while open) by checking each active `RecurringRule` against `lastGeneratedDate` vs. today's occurrence — no service worker or background job, and no pre-generation of future transactions.

### Net worth

Not a stored entity — always derived as `sum(income) - sum(expense) + sum(asset snapshots) - sum(liability snapshots)` at read time.

### Backup/restore and cloud backup share one schema

The manual export/import format (`BackupFile`, with `schemaVersion` for future migrations) built in Phase 5 is the same JSON blob format uploaded/downloaded in Phase 6's Supabase Storage cloud backup. Cloud backup only ever stores this encrypted blob — Supabase Storage with RLS, no Postgres tables, except for the single `is_pro` boolean/expiry record in Phase 7 (the one deliberate exception to "no structured server data," since it's subscription status, not financial data).

## Explicit non-goals (all phases)

No bank account linking, no multi-device real-time sync, no server-side analytics/telemetry on financial data, no shared/team budgets, no automatic currency conversion, no custom budget periods beyond monthly, no local-vault password reset (impossible by design — encourage backups instead).

## Design Context

Full strategic and visual specs live in `PRODUCT.md` (register, users, brand personality, anti-references) and `DESIGN.md` (seed — colors, typography, motion; re-run `/impeccable document` once components exist). Register is **product** (app UI, not marketing). Key principles:

- Vault/security copy (profile creation, unlock, backup) is plain-spoken and reassuring, never legal-disclaimer tone; everyday tracking screens (dashboard, budgets, goals, planner) are warmer and more encouraging.
- Every AI-proposed plan, budget adjustment, or receipt extraction needs a visible confirm step before it's treated as saved — never auto-write AI output to financial records.
- Goal/budget progress widgets read live from the local DB (`useLiveQuery`), not from a static snapshot.
- Never imply a single blended total across currencies — always label which currency a number represents.
- Visual seed: restrained teal-green accent (≤10% of any screen), single humanist sans-serif, flat-by-default elevation, responsive (not choreographed) motion. Explicit anti-references: corporate-fintech navy-and-gold (e.g. Chase/Bank of America), and spreadsheet-style dense tables.
