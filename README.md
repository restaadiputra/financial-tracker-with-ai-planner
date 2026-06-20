# Financial Tracker with AI Planner

A local-first personal finance tracker. Phase 1 ships an encrypted local vault and core transaction tracking — no AI planner, budgets, or goals yet (see [Roadmap](#roadmap)).

**Core principle: your financial data never touches a server.** Everything lives in the browser, encrypted at rest in IndexedDB via [Dexie.js](https://dexie.org/). "Logging in" unlocks a local vault (PBKDF2-SHA256 key derivation + AES-GCM 256-bit encryption via the Web Crypto API) — there is no backend, no account, and no password recovery, by design.

## What's implemented (Phase 1)

- **Local vault**: multi-profile picker, profile creation, and unlock flow. Each profile derives its own AES-GCM key from a password via PBKDF2; a small encrypted "verifier" string confirms the password is correct without ever storing it.
- **Transaction CRUD**: add, edit, delete, and list income/expense transactions, each encrypted individually before being written to IndexedDB (only `profileId` and `date` are stored unencrypted, to support Dexie queries/sorting without decrypting every record).
- **Dashboard**: a transaction list with a running total, scoped to the unlocked profile.
- **Session handling**: the derived vault key lives only in React context for the session (never persisted to storage) and the vault auto-locks after inactivity.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + TypeScript (strict)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
- [Vitest](https://vitest.dev) for unit tests, [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB) for DB tests

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app works entirely client-side — no environment variables are required for Phase 1.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

## Documentation

- [`docs/finance-tracker-prd.md`](docs/finance-tracker-prd.md) — the full product spec: data models, encryption design, and the phase-by-phase build plan.
- [`PRODUCT.md`](PRODUCT.md) — product register, target users, brand personality.
- [`DESIGN.md`](DESIGN.md) — the design system (colors, typography, components) as actually implemented.
- [`CLAUDE.md`](CLAUDE.md) — architecture notes and core principles for anyone (human or AI) working on this codebase.

## Roadmap

Per the PRD, later phases (not yet built) add: budgets, recurring transactions, and goals (Phase 2); an AI planner chat backed by the Anthropic API (Phase 3); receipt scanning via AI extraction (Phase 4); manual JSON backup/restore (Phase 5); and an optional paid tier with encrypted Supabase cloud backup (Phase 6+). Phases 1–5 have zero server/cloud dependency by design.
