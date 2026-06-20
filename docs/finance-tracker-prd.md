# PRD: Local-First Personal Finance Tracker with AI Planner

**Status:** Draft for Claude Code implementation
**Owner:** Resta
**Target stack:** Next.js (App Router) + TypeScript + Tailwind + Dexie.js (IndexedDB)

---

## 1. Product Summary

A web-based personal finance tracker where **all financial data lives entirely on the client device** — there is no server database for transactions, budgets, or any financial records. The app supports multiple local "profiles" (email + password used as a vault unlock mechanism, not real server authentication), AI-powered features (chat-based planning, receipt scanning), and an optional paid cloud backup tier for users who want their encrypted data persisted off-device.

### Core principles (do not violate these during implementation)

1. **No financial data ever touches a server in the Free tier.** Not even for "sync" or "analytics." All reads/writes are to IndexedDB in the browser.
2. **Data at rest is encrypted**, using a key derived from the user's local password. This is not optional — it's what makes "login" honest rather than theater.
3. **AI features that need a server call (chat, receipt OCR) send only the minimum data needed for that single request**, and nothing is persisted server-side as a byproduct of that call. See Section 6.
4. **Pro/cloud backup is the only feature allowed to touch a real backend**, and even then it stores an encrypted blob, not structured queryable financial data.
5. **Simplicity first.** Where a feature could be built two ways — one simple, one "more correct" but complex — default to simple, and leave a comment in code explaining the tradeoff. This PRD calls these out explicitly as `SIMPLICITY NOTE`.

---

## 2. Build Phases (high level)

| Phase | Name | Server dependency | Payment required |
|---|---|---|---|
| 1 | Local vault + core transaction tracking | None | No |
| 2 | Budgets, recurring transactions, goals | None | No |
| 3 | AI Planner (chat → spawns tracked budget plan) | Anthropic API (stateless calls only) | No |
| 4 | Receipt scanning (AI extraction) | Anthropic API (stateless calls only) | No |
| 5 | Manual backup/restore (JSON export/import) | None | No |
| 6 | Pro tier: Cloud backup | Supabase Auth + Supabase Storage | Yes |
| 7 | Payment integration (Indonesia) | iPaymu (or equivalent, re-verify at build time) | — |

Each phase should be buildable and demoable independently. Do not let later phases leak server dependencies into earlier ones (e.g., Phase 1–5 code should have zero Supabase imports).

---

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | Mostly client components; this is a CSR-heavy app despite using Next.js for routing/DX |
| Language | TypeScript | Strict mode on |
| Styling | Tailwind CSS | Match Resta's existing stack |
| Local DB | Dexie.js (wraps IndexedDB) | Chosen over raw IndexedDB (too painful) and LocalStorage (too small, sync-only, no structured queries) |
| Encryption | Web Crypto API (`crypto.subtle`), AES-GCM for data, PBKDF2 or Argon2id for key derivation | No external crypto library needed for AES-GCM/PBKDF2 — native browser API. Argon2id requires `argon2-browser` (WASM) if chosen over PBKDF2 — see Section 4.2 |
| State management | React Context + Dexie's `useLiveQuery` (from `dexie-react-hooks`) | Avoids needing Redux/Zustand; Dexie's live queries handle reactivity to DB changes natively |
| AI | Anthropic API (Claude), called via a thin Next.js API route that proxies the request | API route holds the API key server-side; it does NOT persist any request/response data |
| Charts | Recharts | For net worth, budget envelope visualizations |
| Cloud backup (Pro only) | Supabase Auth + Supabase Storage | No Supabase Postgres tables needed — Storage bucket with RLS is sufficient |
| Payment (Pro only) | iPaymu (re-verify current onboarding requirements before Phase 7) | Chosen for individual/no-PT-required onboarding |

### Why these choices (for the agent's context, not re-litigation)

- **Dexie over raw IndexedDB**: raw IndexedDB requires manual cursor/transaction management that is extremely error-prone for an LLM-driven build. Dexie gives a Mongo-like query API and is the de facto standard wrapper.
- **AES-GCM over AES-CBC**: GCM provides authenticated encryption (detects tampering), which CBC does not. There's no good reason to use CBC here.
- **PBKDF2 as the default key derivation** (not Argon2id) for v1: PBKDF2 is natively available via `crypto.subtle` with zero extra dependencies, and is "good enough" for this threat model (see Section 4.2 for full reasoning and an explicit upgrade path to Argon2id later if desired).

---

## 4. Local Vault & Multi-User Architecture

### 4.1 What "login" actually means here

There is no server-side identity verification in the Free tier. "Email + password" is a **local vault unlock mechanism**. This must be stated honestly in the product UI (see Section 4.5 for required copy). Conceptually this mirrors how Bitwarden's local vault or Standard Notes work: the password isn't checked against a remote source, it's used to derive a key that either successfully decrypts existing local data or doesn't.

### 4.2 Key derivation

- Use `crypto.subtle.importKey` + `crypto.subtle.deriveKey` with **PBKDF2**, SHA-256, minimum **210,000 iterations** (OWASP 2023+ recommendation for PBKDF2-SHA256), to derive an AES-GCM 256-bit key from the password.
- A random salt (16 bytes) is generated per profile at creation time and stored **unencrypted** alongside the profile metadata (salts are not secret).
- `SIMPLICITY NOTE`: Argon2id is the more modern/recommended choice for password-based key derivation (better resistance to GPU cracking), but requires a WASM dependency (`argon2-browser`) and is more complex to get right in a browser context (worker threads recommended to avoid blocking the main thread). PBKDF2 via native `crypto.subtle` is zero-dependency and sufficient for this app's threat model (protecting local data from casual access, not nation-state attackers). **Document this as a deliberate v1 tradeoff.** If Resta wants to upgrade later, it's a contained change to `lib/crypto/deriveKey.ts`.

### 4.3 Data model for profiles

```typescript
// Stored UNENCRYPTED in a dedicated Dexie table `profiles`
interface Profile {
  id: string;              // uuid
  emailHash: string;       // SHA-256(email.toLowerCase()) — used as lookup key, not the raw email
  displayName: string;     // user-chosen, shown in profile switcher UI
  salt: string;            // base64, 16 bytes, used for PBKDF2
  verifier: string;        // base64 — see "password verification" below
  verifierIv: string;      // base64 — IV used for the verifier encryption
  createdAt: number;
}
```

**Password verification without storing the password:** On profile creation, encrypt a known constant string (e.g. `"VAULT_OK"`) with the derived key and store the ciphertext as `verifier`. On unlock attempt, derive the key from the entered password + stored salt, attempt to decrypt `verifier`. If it decrypts to `"VAULT_OK"`, the password is correct and the key is now held in memory for the session. AES-GCM's built-in authentication tag means a wrong key will fail decryption (not silently produce garbage), so this is a reliable check.

### 4.4 Per-profile encrypted data

All financial data tables (`transactions`, `budgets`, `goals`, `recurringRules`, `aiChatHistory`) are scoped by `profileId` and store an `encryptedPayload` (the actual financial fields, JSON-stringified then AES-GCM encrypted) plus a small set of **unencrypted indexing fields** needed for Dexie queries without decryption:

```typescript
interface TransactionRecord {
  id: string;
  profileId: string;       // unencrypted — used to scope queries to active profile
  date: number;             // unencrypted (epoch ms) — needed for date-range queries/sorting
  iv: string;                // base64, unique per record
  encryptedPayload: string; // base64 ciphertext of: { amount, currency, category, note, type, ... }
}
```

`SIMPLICITY NOTE`: leaving `date` unencrypted means an attacker with raw IndexedDB access could see *when* the user transacted and how often, but not amounts/categories/notes. This is a deliberate tradeoff to keep date-range queries fast and simple (Dexie can index and query `date` directly without decrypting every record first). If Resta wants maximum privacy (fully opaque records), all sorting/filtering would need to happen in-memory after bulk decryption — acceptable at small data volumes (a personal finance app rarely exceeds a few thousand transactions) but worth flagging as a conscious choice, not an oversight.

### 4.5 Multi-user switching flow

1. App loads → reads `profiles` table (unencrypted) → shows a profile picker (avatar/name tiles), **not a generic login form**. This matches "switch user easily."
2. User taps their profile → prompted for password → key derived → verifier checked → on success, key held in a React Context (`VaultContext`) for the session, **never persisted** (not in localStorage, not in a cookie).
3. "Switch user" = clear `VaultContext`, return to profile picker. No need to reload the page.
4. "Add new profile" = small form (display name, email, password, confirm password) → generates salt, derives key, creates verifier, inserts into `profiles`.
5. **Required onboarding copy** (exact intent, wording can be polished): *"This protects your data on this device. We don't store your password anywhere, and we can't reset it for you. If you forget it, your local data can't be recovered unless you've made a backup."* This must appear at profile creation, not buried in settings.

### 4.6 Session timeout

`SIMPLICITY NOTE`: implement a simple inactivity timeout (e.g. 15 minutes, configurable in settings) that clears `VaultContext` and returns to the profile picker. This is a reasonable default for a finance app on a shared device; don't over-engineer this in v1 (no need for cross-tab sync of the timeout, etc.).

---

## 5. Core Data Model (decrypted shape — what `encryptedPayload` contains once decrypted)

### 5.1 Transaction

```typescript
interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;            // store as integer minor units? No — see currency note below
  currency: string;          // ISO 4217, e.g. "IDR", "USD"
  category: string;          // references Category.id
  note?: string;
  date: number;               // epoch ms (also stored unencrypted, see 4.4)
  recurringRuleId?: string;  // present if generated from a recurring rule
  receiptImageRef?: string;  // present if created via receipt scan — see Section 8
  createdAt: number;
  updatedAt: number;
}
```

**Currency/amount storage note:** Store `amount` as a plain JS number representing the currency's base unit (e.g. `50000` for Rp 50.000), NOT minor units (cents). Rupiah has no minor unit in practical use, and supporting both IDR and minor-unit currencies (USD) cleanly is unnecessary complexity for a personal tracker. `SIMPLICITY NOTE`: floating point errors are a real concern for accounting software, but for a personal-use tracker (not double-entry bookkeeping, no audit requirements), plain numbers are acceptable. If this becomes multi-currency-heavy later, revisit with a decimal library (e.g. `decimal.js`).

### 5.2 Category

```typescript
interface Category {
  id: string;
  name: string;
  icon: string;        // icon identifier (e.g. lucide-react icon name)
  color: string;        // hex
  type: 'income' | 'expense' | 'both';
  isDefault: boolean;   // seeded categories vs user-created
}
```

Seed a sensible default category list on first profile creation (Food, Transport, Housing, Bills/Subscriptions, Shopping, Health, Entertainment, Salary, Freelance/Business, Transfer, Other). Keep this list short; users can add more.

### 5.3 Budget Envelope

```typescript
interface Budget {
  id: string;
  categoryId: string;
  amount: number;             // budgeted amount for the period
  currency: string;
  period: 'monthly';          // v1: monthly only, no custom periods
  alertThresholdPct: number;  // e.g. 80 — triggers overspend warning UI at 80% spent
  createdAt: number;
}
```

`SIMPLICITY NOTE`: v1 supports monthly budgets only. Weekly/custom periods add real complexity (period boundary math, partial-period prorating) for limited value at this stage — explicitly deferred.

### 5.4 Recurring Rule (subscriptions / recurring transactions)

```typescript
interface RecurringRule {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  category: string;
  note?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dayOfMonth?: number;     // for monthly/yearly
  dayOfWeek?: number;      // for weekly
  startDate: number;
  endDate?: number;         // optional — open-ended if absent
  isActive: boolean;
  lastGeneratedDate?: number;
}
```

**Generation strategy:** On app load (and once per day while the app is open), check all active `RecurringRule`s and generate any `Transaction`s that are due (i.e., `lastGeneratedDate` < today's occurrence date), up to and including today. Do not pre-generate future transactions — generate lazily, on the date they occur. This avoids needing a background job/service worker for v1.

### 5.5 Goal (savings goal / debt payoff)

```typescript
interface Goal {
  id: string;
  name: string;
  type: 'savings' | 'debt_payoff';
  targetAmount: number;
  currentAmount: number;     // manually updated, OR derived — see note
  currency: string;
  targetDate?: number;
  linkedCategoryId?: string; // optional: auto-derive progress from transactions in this category
  createdAt: number;
}
```

`SIMPLICITY NOTE`: v1 should support **manual progress updates** (user types in current saved amount) as the primary mechanism. Auto-deriving progress from transactions tagged to a linked category is a nice-to-have — implement it only if `linkedCategoryId` is set, otherwise fall back to manual. Don't force every goal to require category-linking; that's friction for a "I'm saving for a laptop" goal that doesn't map cleanly to one spending category.

### 5.6 Net Worth (derived, not stored)

Net worth is **not a separate stored entity** in v1 — it's a derived view: `sum(all income transactions) - sum(all expense transactions)` over the user's full history, optionally with manually-entered "Asset" and "Liability" snapshot entries for things that aren't transactions (e.g. current savings account balance, outstanding loan balance).

```typescript
interface AssetLiabilitySnapshot {
  id: string;
  name: string;            // e.g. "BCA Savings", "Car Loan"
  kind: 'asset' | 'liability';
  amount: number;
  currency: string;
  updatedAt: number;
}
```

Net worth = `sum(income) - sum(expense) + sum(asset snapshots) - sum(liability snapshots)`. This is intentionally simple (no historical net-worth-over-time charting in v1 beyond what can be derived from transaction dates) — flagged as a possible v2 feature, not required now.

### 5.7 Multi-currency handling

`SIMPLICITY NOTE`: v1 should let each transaction carry its own `currency` field (so a Bali-based freelancer can log a USD client payment and IDR daily expenses), but **v1 does NOT do automatic currency conversion**. Totals/budgets/goals are calculated **per-currency** (e.g., show "Total IDR" and "Total USD" separately rather than a single blended number). Auto-converting requires either a live FX rate API (a server dependency, conflicts with local-first principle, plus rates go stale) or manual rate entry (extra UI complexity) — both explicitly deferred to v2. This is a real limitation worth being upfront about in the UI (e.g. small label: "Totals shown per currency").

---

## 6. AI Planner (chat-driven, spawns a tracked plan)

This is the flagship differentiator. The flow Resta specified: user chats something like *"I want to save 10 million rupiah this month"* → the AI creates a **trackable budget plan artifact** (a real `Goal`/`Budget` entity in the local DB, not just a chat reply) → a dedicated UI area (outside the chat) tracks actual income/spending against that plan in real time → the AI gives **ongoing suggestions** based on real progress (e.g. "reduce dining out by 200k" or "you need 500k more income this week").

### 6.1 Why this needs special architectural care

The AI does not have server-side access to the user's financial data (by design — Section 1, principle 3). So the chat interaction must work like this:

1. User sends a message in the planner chat UI.
2. **Client-side code** (not the AI) gathers relevant context from the local encrypted DB: current month's transactions (decrypted in-memory, client-side only), existing budgets, existing goals.
3. This context + the user's message + conversation history is sent to a **stateless Next.js API route** (`/api/ai/plan`), which calls the Anthropic API with that context in the prompt.
4. The API route returns the AI's response **and, if applicable, a structured "plan proposal" object** (see 6.3) — the API route does NOT write anything to any database. It's a pure function: context in, response out.
5. Client receives the response. If a plan proposal is present, show a confirmation UI ("Create this budget plan?") before writing anything to local IndexedDB. Never auto-write AI output to the user's financial records without a confirm step — AI can misread amounts/intent.
6. Once confirmed, the client creates the actual `Goal` and/or `Budget` records locally.

### 6.2 Structured output approach

The API route should prompt Claude to return **structured JSON** (using the pattern described in product context: instruct the model to output JSON only) so the client can reliably parse out a plan proposal versus a plain conversational reply. Suggested response shape from `/api/ai/plan`:

```typescript
interface AIPlannerResponse {
  message: string;              // conversational reply to show in chat
  proposedPlan?: {
    type: 'savings_goal' | 'budget_adjustment';
    goalName?: string;
    targetAmount?: number;
    currency?: string;
    targetDate?: number;          // e.g. end of current month
    budgetAdjustments?: {
      categoryId: string;
      suggestedAmount: number;
    }[];
  };
}
```

`SIMPLICITY NOTE`: Don't over-engineer turn-by-turn conversational state on the server. The entire chat history relevant to context is sent fresh on every call (the API route is stateless, per principle 3) — `aiChatHistory` is stored locally (encrypted, like everything else) and replayed into the prompt as needed. This is more token-expensive than a server-side session but is the only architecture consistent with "no server database."

### 6.3 The "tracked plan" UI (outside the chat)

Once a plan is confirmed, render a **persistent dashboard widget** (e.g. a card pinned above or beside the chat) showing:

- Goal name + target (e.g. "Save Rp 10,000,000 this month")
- Progress bar: current net savings this month (income − expenses, scoped to the goal's date range) vs target
- Days remaining in the period
- Required daily/weekly pace to hit the target from today

This widget reads live from the local DB (via `useLiveQuery`) — it is NOT static data frozen at creation time. As the user logs new transactions throughout the month (manually or via receipt scan), the widget updates automatically.

### 6.4 Proactive suggestions

On each visit to the planner view (or on a manual "refresh suggestions" action — avoid calling the AI API on every single keystroke/render to control cost), re-send current progress to `/api/ai/plan` with a system instruction like: *"Given the user is at X% of their savings goal with Y days remaining, suggest 1-2 concrete actions (specific category to cut, or income target)."* Render this as a small "Suggestion" callout near the progress widget, distinct from the chat transcript.

`SIMPLICITY NOTE`: v1 does not need real-time/automatic suggestion refresh on every transaction add. A manual "Get updated suggestion" button, or a refresh on planner-tab-open (debounced, e.g. max once per hour), is sufficient and keeps API costs predictable.

### 6.5 Cost & abuse control

Since `/api/ai/plan` is a server endpoint that costs Resta money per call (Anthropic API usage), even in the Free tier:

- Add basic rate limiting (e.g. per-IP or per-session, a simple in-memory or edge-config limiter — doesn't need a database; libraries like `@upstash/ratelimit` work with Redis if Resta wants persistence, but an in-memory limiter is fine for v1 given no server DB).
- Cap context size sent per request (e.g. last 90 days of transactions max, not entire history) to control token cost.
- Consider whether AI planner usage should itself be a soft-gated feature (e.g. N free plan generations per month) even before the Pro paywall exists for backup — this is a business decision for Resta, flagged here for awareness, not prescribed.

---

## 7. Receipt Scanning (AI extraction)

1. User uploads/photographs a receipt image in the transaction-add flow.
2. Image is sent (client-side, base64) to a stateless API route `/api/ai/receipt`, which calls Claude with vision input, prompted to return structured JSON: `{ amount, merchantName, suggestedCategory, date, lineItems? }`.
3. **Image is not persisted server-side.** The API route processes and discards it — no logging the image, no storing it in any bucket. State this explicitly in code comments at the route handler since it's easy for a future contributor (or AI agent) to accidentally add logging that violates this.
4. Client receives the structured extraction, pre-fills the transaction form for user review/edit, user confirms → saved locally (encrypted) like any other transaction.
5. **Local image storage (optional, user's choice):** if the user wants to keep the receipt image attached to the transaction for their own records, store the image **client-side only** (e.g. as a Blob in a separate Dexie table, encrypted same as other data), referenced by `Transaction.receiptImageRef`. Never upload the raw image anywhere persistent.

`SIMPLICITY NOTE`: v1 should treat the AI extraction as a starting point requiring user confirmation, never auto-saving a transaction straight from OCR — receipts are often messy/low quality and silent miscategorization or wrong amounts would erode trust fast in a finance app.

---

## 8. Manual Backup & Restore (Free tier, build this in Phase 5)

This should ship before the Pro cloud tier, both because it's good practice regardless of monetization and because it establishes the exact JSON schema that cloud backup will reuse in Phase 6.

### 8.1 Export

- Button in Settings: "Export backup."
- Decrypts all of the active profile's data in memory, assembles into a single JSON file, triggers a browser download (`a[download]` + `Blob`, no server involved).
- Schema:

```typescript
interface BackupFile {
  schemaVersion: 1;
  exportedAt: number;
  profileDisplayName: string;
  data: {
    transactions: Transaction[];
    categories: Category[];
    budgets: Budget[];
    recurringRules: RecurringRule[];
    goals: Goal[];
    assetLiabilitySnapshots: AssetLiabilitySnapshot[];
    aiChatHistory?: AIChatMessage[];
  };
}
```

- **Decide explicitly whether the exported file itself is encrypted or plaintext JSON.** Recommendation: prompt the user to set a (possibly separate) backup passphrase and encrypt the export file too — an unencrypted financial export sitting in a Downloads folder is a real risk. Use the same AES-GCM approach; derive a key from the backup passphrase the same way as the vault password (Section 4.2). This means restore requires re-entering that passphrase.
- `schemaVersion` exists from day one specifically so that if the data model changes later, `import` can detect old versions and run a migration function rather than failing or corrupting data.

### 8.2 Import/Restore

- "Restore from backup" in Settings (or in the "Add new profile" flow, as an alternative to creating a fresh empty profile).
- User selects file → enters backup passphrase if encrypted → file is decrypted/parsed → validated against `schemaVersion` → if it's an older version, run migration → write all records into a (new or selected) local profile, re-encrypting with that profile's vault key (the backup's encryption and the profile's vault encryption are independent layers).
- Always confirm with the user before overwriting an existing non-empty profile's data.

---

## 9. Pro Tier: Cloud Backup

Only this phase introduces real server-side auth and storage. Built last, but architecture decided now so Phase 1-5 code doesn't need rework.

### 9.1 Why Supabase

- Supabase Auth handles email/password (or magic link) auth with minimal setup, and Resta is already familiar with it from PRDGen/other projects.
- **No Postgres tables are needed.** Use **Supabase Storage** only: one bucket (e.g. `backups`), with Row Level Security policies scoping access to `auth.uid()`, storing one object per user (the same encrypted `BackupFile` JSON blob from Section 8, just uploaded instead of downloaded).
- This keeps the "no server database for financial data" principle technically and spiritually intact — there's no queryable structured financial data on the server, ever, even for paying users. It's an encrypted blob Supabase cannot read.

### 9.2 Flow

1. Pro user (post-payment, see Section 10) creates a Supabase Auth account (separate from their local vault password — these are deliberately decoupled; local vault protects the device, Supabase auth protects the cloud blob).
2. "Backup to cloud" button (in addition to / instead of manual download) encrypts the same `BackupFile` JSON (Section 8.1) and uploads to their Storage path, e.g. `backups/{auth.uid()}/latest.json`. Consider keeping a small number of versioned backups (e.g. last 5) rather than only overwriting "latest," so a bad backup doesn't destroy the only cloud copy — cheap to implement, meaningfully safer.
3. "Restore from cloud" on a new device: sign in to Supabase Auth, list/download their backup blob(s), decrypt with backup passphrase, import as in Section 8.2.

### 9.3 Explicit non-goals for Pro v1

- No automatic/background sync. Cloud backup is a manual, user-initiated action (a button), not a live sync engine — live sync would require conflict resolution across devices, which is a substantially harder problem and not what was asked for.
- No real-time multi-device data sharing. Each device still has its own local vault; cloud backup is for disaster recovery and moving to a new device, not simultaneous multi-device use.

---

## 10. Payment (Indonesia, Pro tier gating)

- **Recommended gateway: iPaymu** — individual-friendly onboarding (registration without a formal business entity/PT), which matches Resta's constraint. **Re-verify iPaymu's current onboarding requirements directly before implementing Phase 7** — payment gateway KYC/registration rules change and this PRD's web research has a shelf life.
- Midtrans was also evaluated — it's the most widely used gateway in Indonesia (owned by GoTo/Gojek/Tokopedia) but its standard onboarding tends to assume a registered merchant/business entity; worth a second look only if iPaymu's terms turn out to be unsuitable when Resta gets to this phase.
- Payment only needs to gate **one boolean per Supabase Auth user**: `isPro`. Simplest implementation: a single Supabase Storage object or a minimal Postgres table (`{ user_id, is_pro, expires_at }`) updated via webhook from the payment gateway on successful payment. This is the one place a tiny structured table is justified — it's subscription status, not financial data.
- Out of scope for this PRD to fully design (explicitly the last phase per Resta's instructions) — revisit gateway integration details, webhook handling, and subscription vs one-time payment model when Phases 1-6 are complete.

---

## 11. Suggested Project Structure

```
/app
  /(vault)
    page.tsx                 # profile picker / unlock screen
  /dashboard
    page.tsx
  /transactions
    page.tsx
  /budgets
    page.tsx
  /planner
    page.tsx                 # AI planner chat + tracked plan widget
  /goals
    page.tsx
  /settings
    page.tsx                 # backup/restore, session timeout, Pro upgrade
  /api
    /ai
      /plan/route.ts         # stateless Anthropic API proxy for planner chat
      /receipt/route.ts      # stateless Anthropic API proxy for receipt OCR
/lib
  /db
    schema.ts                 # Dexie schema definitions
    db.ts                      # Dexie instance
  /crypto
    deriveKey.ts               # PBKDF2 key derivation
    encrypt.ts                 # AES-GCM encrypt/decrypt helpers
  /vault
    VaultContext.tsx           # session key holder, profile switching logic
  /recurring
    generateDueTransactions.ts
  /backup
    exportBackup.ts
    importBackup.ts
/components
  /transactions, /budgets, /planner, /goals, /charts  # feature-scoped UI components
```

---

## 12. Phase-by-Phase Build Prompts (paste-ready for Claude Code)

Each phase below is meant to be pasted as a single prompt to Claude Code, in order. Each assumes the previous phase's code exists.

### Phase 1 prompt

> Set up a Next.js 15 App Router + TypeScript + Tailwind project. Implement the local vault system per Section 4 of the PRD: Dexie schema for `profiles`, PBKDF2 key derivation + AES-GCM encrypt/decrypt helpers in `lib/crypto/`, a `VaultContext` for holding the session key, and a profile-picker UI (not a generic login form) for creating/unlocking/switching profiles. Include the required onboarding copy from Section 4.5 verbatim at profile creation. Then implement basic Transaction CRUD (add/edit/delete/list) per Section 5.1, with the encrypted-payload + unencrypted-date-field pattern from Section 4.4. Seed default categories per Section 5.2 on profile creation. Build a simple dashboard showing a transaction list and running total. Do not implement budgets, goals, AI, or backup yet — those are later phases.

### Phase 2 prompt

> Building on Phase 1: implement Budget envelopes (Section 5.3) with a UI showing spent-vs-budgeted per category and a visual overspend warning at the configured threshold. Implement Recurring Rules (Section 5.4) including the lazy generation-on-load strategy — no service worker or background job. Implement Goals (Section 5.5) with manual progress entry as the default and optional category-linked auto-progress. Implement the derived Net Worth view (Section 5.6) including manual Asset/Liability snapshot entry. Respect the multi-currency-without-conversion approach from Section 5.7 — show per-currency totals, label clearly that conversion isn't automatic.

### Phase 3 prompt

> Building on Phase 2: implement the AI Planner per Section 6. Build the stateless `/api/ai/plan` route per Section 6.1-6.2 (uses the Anthropic API, takes context + message, returns structured JSON per the `AIPlannerResponse` shape, persists nothing server-side). Build the chat UI and the separate tracked-plan dashboard widget (Section 6.3) that reads live from local Dexie data via `useLiveQuery` — confirm with the user before writing any AI-proposed plan to the local DB. Implement the proactive suggestion refresh (Section 6.4) as a manual/debounced action, not real-time. Add basic rate limiting to the API route per Section 6.5.

### Phase 4 prompt

> Building on Phase 3: implement receipt scanning per Section 7. Build the stateless `/api/ai/receipt` route (Claude vision call, structured extraction, explicitly does not log or persist the image). Build the upload/capture UI that pre-fills a transaction form from the extraction for user review before saving. Implement optional local-only encrypted receipt image storage per Section 7 point 5.

### Phase 5 prompt

> Building on Phase 4: implement manual backup/restore per Section 8. Build the export flow (decrypt all profile data, prompt for a backup passphrase, encrypt the JSON export, trigger download) and import flow (file picker, passphrase entry, schemaVersion validation/migration stub, confirm-before-overwrite). This phase has no server dependency — purely local file I/O.

### Phase 6 prompt (do not start until Resta explicitly says so — has new server/infra setup)

> Building on Phase 5: implement Pro cloud backup per Section 9. Set up Supabase Auth (separate from local vault auth) and a Supabase Storage bucket with RLS scoped to `auth.uid()`. Build "backup to cloud" (uploads the same encrypted BackupFile blob, keeps last 5 versions) and "restore from cloud" (list/download/decrypt/import) flows. No Postgres tables for financial data — storage blob only.

### Phase 7 prompt (do not start until Resta explicitly says so — payment integration)

> Building on Phase 6: integrate iPaymu (re-verify current onboarding/API requirements first) to gate Pro features behind payment. Add a minimal `is_pro` status table/object as described in Section 10, updated via payment webhook. Build the upgrade UI and paywall checks around the cloud backup feature.

---

## 13. Explicit Non-Goals (v1, all phases)

To keep scope honest and prevent an AI build agent from "helpfully" over-building:

- No bank account linking / Open Banking integrations.
- No multi-device real-time sync.
- No server-side analytics or telemetry on financial data, ever.
- No team/family shared budgets (each profile is independent; sharing is out of scope).
- No automatic currency conversion (Section 5.7).
- No custom budget periods beyond monthly (Section 5.3).
- No password reset flow for the local vault (impossible by design — no server has the password; only mitigation is encouraging backups).

---

## 14. Open Questions for Resta (revisit before/during relevant phase)

1. Should the AI planner (Phase 3) be rate-limited or capped even for free users, given it costs real Anthropic API spend? (Flagged in 6.5, not decided here.)
2. Backup file encryption: same passphrase as vault password, or a separate backup-specific passphrase? (Section 8.1 recommends separate, but it's a UX tradeoff — separate is more secure but one more thing to remember.)
3. iPaymu's exact current onboarding requirements should be re-verified right before Phase 7, not assumed from this PRD's research date.
4. Subscription vs one-time payment for Pro? Not decided — affects the `is_pro` data model in Section 10.
