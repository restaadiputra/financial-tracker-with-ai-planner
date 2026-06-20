<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->

---
name: Local-First Finance Tracker
description: A friendly, honest personal finance vault with an AI planner — calm enough to trust with real money, warm enough to check daily.
---

# Design System: Local-First Finance Tracker

## 1. Overview

**Creative North Star: "The Honest Ledger"**

A system built on two registers that share one voice: the day-to-day tracking surfaces (dashboard, budgets, goals, planner) feel like Monarch Money's warm, card-based encouragement crossed with Notion's approachable typographic calm; the vault/security surfaces (profile picker, unlock, backup/restore) borrow Linear's crisp, no-nonsense precision and Bitwarden's plain-spoken honesty about what it can and can't do for you. Neither register performs trust through decoration — corporate-bank navy-and-gold theater (Chase, Bank of America) is explicitly rejected, as is the sterile, dense look of spreadsheet software. Warmth is carried by typography, spacing, and a single restrained teal-green accent, not by gradients, glassmorphism, or cheerful illustration.

**The Restrained Rule.** Tinted neutrals carry the vast majority of every screen; the accent color appears on no more than ~10% of any given surface, reserved for primary actions, progress, and the signal that something is going well. Its rarity is what makes it mean something.

**Key Characteristics:**
- Calm, mostly-neutral surfaces; one teal-green accent used sparingly and deliberately
- Single humanist sans-serif, multiple weights, no display/body font pairing needed
- Motion is responsive (state changes, fills, hover/focus feedback) — never choreographed or showy
- Vault/security screens read calmer and more plain-spoken than the day-to-day tracking screens, without breaking the same type system or spacing scale

## 2. Colors

**The Restrained Rule** (see Overview) governs the whole palette: tinted neutrals + one accent, ≤10% of any screen.

### Primary
- **Teal-green accent** `[to be resolved during implementation]`: the one named color in the system. Used for primary buttons, progress-bar fills, positive balance/income indicators, and active states. Never used as a body-background wash.

### Neutral
- **Background / surface / ink ramp** `[to be resolved during implementation]`: a tinted-neutral scale (not pure gray, not cream/sand) anchored to the teal-green's own hue at very low chroma, per OKLCH tinted-neutral convention. Carries body backgrounds, card surfaces, borders, and primary text.

### Named Rules
**The One Accent Rule.** There is exactly one named accent color in this system. If a second color seems necessary (e.g. for an expense/alert state), reach for a deeper or more saturated step of the same neutral ramp, or a true semantic red/amber reserved only for destructive/overspend states — never a second decorative accent.

## 3. Typography

**Display Font:** `[font pairing to be chosen at implementation]` — single humanist sans-serif family
**Body Font:** same family, lighter weight
**Label/Mono Font:** `[to be resolved during implementation]` — consider a tabular-numeral variant or mono for transaction amounts, so figures align in lists

**Character:** Warm and legible rather than geometric or technical — friendly enough for daily encouragement, restrained enough to stay credible holding real financial numbers.

### Hierarchy
- **Display** (`[weight/size to be chosen]`): dashboard headline numbers (net worth, goal progress) — the one place type is allowed to feel a little large and confident.
- **Headline / Title**: section headers, card titles, the unlock/profile-picker screen's primary heading.
- **Body** (max 65–75ch where prose appears, e.g. onboarding/vault copy): transaction notes, settings copy, AI planner chat.
- **Label**: form labels, table headers, category chips, dates.

### Named Rules
**The Tabular Numbers Rule.** Any amount displayed in a list, table, or progress widget uses tabular (fixed-width) numerals so figures align vertically — a real legibility requirement, not a stylistic flourish, for a finance app.

## 4. Elevation

Flat by default, consistent with Responsive (not Choreographed) motion energy: surfaces sit on the tinted-neutral background with minimal or no shadow at rest. Depth is conveyed through subtle surface-color steps (a card is a slightly lighter/darker neutral than its background) rather than drop shadows. A soft ambient shadow is reserved for genuinely floating elements (modals, the AI planner's confirm-plan sheet, dropdowns) where depth needs to be unambiguous.

### Named Rules
**The Flat-By-Default Rule.** Cards and panels are flat at rest. Shadow appears only for elements that are functionally above the page flow (modals, popovers, the plan-confirmation sheet) — never decoratively on a static card.

## 5. Components

*(Omitted in seed mode — no components exist yet. Re-run `/impeccable document` once buttons, cards, inputs, and the profile-picker/planner widgets are built, to extract real shape, color, and state values.)*

## 6. Do's and Don'ts

### Do:
- **Do** keep the accent (teal-green) to ≤10% of any screen — primary actions, progress fills, positive-balance signals only.
- **Do** make the vault/security copy (profile creation, unlock, backup passphrase prompts) plain-spoken and reassuring, matching Bitwarden/Standard Notes' honesty about local-only password storage — never legal-disclaimer tone.
- **Do** use tabular numerals for any amount in a list or table.
- **Do** keep motion responsive (transitions, fills, hover/focus feedback) and skip orchestrated entrance sequences — this is a daily-use utility, not a marketing page.
- **Do** always label which currency a total represents — never imply a blended number across currencies.

### Don't:
- **Don't** use a navy-and-gold corporate-fintech palette or anything that reads like the Chase or Bank of America app — that's the explicit anti-reference for this project.
- **Don't** build dense, sterile, Excel/Google-Sheets-style tables for transactions or budgets — this is not double-entry bookkeeping software.
- **Don't** use gradient text, glassmorphism, or decorative blur — warmth comes from type and spacing, not surface effects.
- **Don't** use side-stripe (`border-left`) colored accents on cards or list items.
- **Don't** auto-write AI-proposed plans or extracted receipt data into the UI as if confirmed — every AI suggestion needs a visible confirm step before it looks "saved."
