---
name: Local-First Finance Tracker
description: A friendly, honest personal finance vault with an AI planner — calm enough to trust with real money, warm enough to check daily.
colors:
  background: "oklch(98% 0.004 165)"
  surface: "oklch(96% 0.006 165)"
  foreground: "oklch(22% 0.012 165)"
  muted: "oklch(46% 0.012 165)"
  border: "oklch(89% 0.008 165)"
  accent: "oklch(55% 0.12 165)"
  accent-foreground: "oklch(99% 0.004 165)"
  danger: "oklch(55% 0.18 25)"
  danger-foreground: "oklch(99% 0.004 25)"
typography:
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  amount:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    fontFeature: "tnum"
rounded:
  sm: "8px"   # implemented as the `rounded-control` utility (app/tokens.css)
  md: "12px"  # implemented as the `rounded-callout` utility (app/tokens.css)
  lg: "16px"  # implemented as the `rounded-card` utility (app/tokens.css)
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
  profile-tile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "24px 16px"
---

# Design System: Local-First Finance Tracker

## 1. Overview

**Creative North Star: "The Honest Ledger"**

The implemented system carries through the seed's two-register premise. Day-to-day surfaces (the dashboard's running total and transaction list) and vault surfaces (profile picker, unlock, create-profile) share one type system, one spacing rhythm, and the same restrained teal-green accent — but the vault surfaces stay quieter: plain copy, no progress bars, no color beyond the avatar badge and the one primary button. Corporate-bank navy-and-gold theater (Chase, Bank of America) and dense spreadsheet tables are absent, as specified. Warmth comes entirely from spacing, rounded surfaces, and plain-spoken copy (the onboarding reassurance callout reads like a person talking, not a disclaimer) — there is no gradient, no glassmorphism, no decorative illustration anywhere in the built surfaces.

**The Restrained Rule.** Confirmed in the real build: the accent (`oklch(55% 0.12 165)`) appears only on the primary button, the profile-avatar badge, the income amount, and the focus outline. Every other surface is the neutral ramp. Across the dashboard, the accent occupies well under 10% of the screen.

**Key Characteristics:**
- One color family carries the system: a teal-hued (165°) neutral ramp at near-zero chroma (0.004–0.012) for background/surface/ink/border, plus one teal-green accent at higher chroma (0.12) for action and positive-value signaling
- Single sans-serif (Inter) at four weights/sizes — no display/body pairing, matching the seed's "no pairing needed" call
- `tabular-nums` is applied everywhere a currency amount renders (running total, transaction rows, form amount field) — the seed's Tabular Numbers Rule is implemented exactly, not approximated
- Flat by default; shadow is reserved for the one floating overlay primitive (the `Sheet`, used by the transaction form and the profile menu)
- Light is the default theme, and the theme is user-controlled (Light / Dark / System in the profile menu's Appearance control), persisted to `localStorage` and applied as `data-theme` on `<html>` by a no-FOUC inline script. Dark is a first-class paired palette at the same hue (restepped lightness), never a silent media-query fallback

## 2. Colors

**The Restrained Rule** (see Overview) governs the whole palette: tinted neutrals + one accent, ≤10% of any screen. The palette is a single hue family — 165° (teal-green) — split into a near-zero-chroma neutral ramp and one higher-chroma accent step, confirmed exactly as specified in the seed.

### Primary
- **Teal-green accent** (`oklch(55% 0.12 165)`, dark mode `oklch(68% 0.13 165)`): the one named color in the system. Used for the primary button fill, the profile-avatar badge, the focus-visible outline, and income amounts (`text-accent`). Never used as a body-background wash.
- **Accent hover/active steps** (`accent-hover` `oklch(48% 0.12 165)` / `accent-active` `oklch(42% 0.12 165)`, dark mode lightens instead: `oklch(74% 0.13 165)` / `oklch(79% 0.13 165)`): deliberate state steps off the same hue — darker on hover/press in light mode, lighter in dark mode, since the accent sits at mid-lightness in both palettes.

### Neutral
- **Background** (`oklch(98% 0.004 165)`, dark `oklch(17% 0.01 165)`): the page canvas.
- **Surface** (`oklch(96% 0.006 165)`, dark `oklch(21% 0.012 165)`): one step off background — cards, the transaction-list container, the profile tile, the onboarding-copy callout. Depth comes from this step alone, never from shadow.
- **Foreground** (`oklch(22% 0.012 165)`, dark `oklch(95% 0.008 165)`): primary text and expense amounts.
- **Muted** (`oklch(46% 0.012 165)`, dark `oklch(70% 0.012 165)`): secondary text — helper copy, dates, "Switch profile," "Edit," labels.
- **Border** (`oklch(89% 0.008 165)`, dark `oklch(30% 0.014 165)`): all card, input, and divider strokes — always a full 1px border, never a side-stripe.

### Semantic
- **Danger** (`oklch(55% 0.18 25)`, dark `oklch(62% 0.17 25)`): a true red-orange off the teal hue, reserved for inline validation errors and the "Delete" hover state. This is the system's only sanctioned second color, exactly matching the seed's One Accent Rule exception for destructive states.

### Named Rules
**The One Accent Rule.** Confirmed in the build: the only colors in use are the neutral ramp, the one teal-green accent, and the danger red reserved for destructive/error states. No third decorative color exists anywhere in the codebase.

**The Tinted-Neutral Rule.** Every neutral token carries a small amount of the accent's own hue (165°) at chroma 0.004–0.014 rather than going pure gray or warm cream/sand — this is what keeps the vault surfaces feeling like part of the same system as the accent-bearing dashboard.

## 3. Typography

**Body/Display Font:** Inter (via `next/font/google`), with `system-ui, sans-serif` fallback — one family, no pairing, per product register guidance.

**Character:** A neutral, highly legible grotesque — warm enough not to feel clinical, restrained enough to hold real financial numbers without performing friendliness.

### Hierarchy
Each named size below is backed by a real Tailwind v4 theme token (`--text-*` in `app/tokens.css`), not just convention — use the named utility (`text-headline`, `text-title`, etc.) rather than a raw size like `text-3xl`.
- **Headline** (`text-headline`; 600, 1.875rem/30px, line-height 1.2, `-0.01em`): the vault picker's "Who's tracking today?" — the one moment type is allowed to feel confident. Not used elsewhere; this is intentionally rare.
- **Title** (`text-title`; 600, 1.5rem/24px, line-height 1.25): page-level headings — "Unlock {name}'s vault," "Create a profile," the dashboard's profile-name heading, and the add/edit-transaction sheet title.
- **Amount** (`text-amount`; 600, 1.5rem/24px, `font-variant-numeric: tabular-nums`): the running-total figures. Same size as Title but reserved exclusively for money.
- **Body** (`text-body`; 400, 1rem/16px, line-height 1.5): all form inputs and selects.
- **Label** (`text-label`; 500, 0.875rem/14px, line-height 1.4): form field labels, muted secondary text (dates, helper copy), button text, the per-currency total caption.
- **Micro-label** (`text-micro-label`; 500, 0.75rem/12px, uppercase, tracked): the "TOTAL IDR" caption above each currency total — the system's only uppercase-tracked text, used exactly once per total, not as a recurring eyebrow.

### Named Rules
**The Tabular Numbers Rule.** Implemented via Tailwind's `tabular-nums` utility on every rendered amount: the running-total figures, each transaction row's amount, and the amount input in the add/edit form. Figures align vertically in the transaction list as designed.

## 4. Elevation

Flat by default, confirmed in the build: the dashboard's running-total card, the transaction-list container, and the profile tiles all use a surface-color step (`surface` vs. `background`) plus a 1px `border` — zero shadow. The single exception is the `Sheet` overlay primitive (used by the transaction form and the profile menu), which uses `shadow-lg` (`0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`) behind a `backdrop-blur-sm` scrim — exactly the "genuinely floating element" case the seed called out in advance.

### Shadow Vocabulary
- **Floating-sheet** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): the `Sheet` overlay primitive only.

### Named Rules
**The Flat-By-Default Rule.** Confirmed: every static card and panel in the build is flat. Shadow appears exactly once, on the one component that is functionally above the page flow.

## 5. Components

### Buttons
- **Shape:** `rounded.sm` (8px) on every button in the system — primary, secondary, and the expense/income toggle.
- **Primary** (`button-primary`): `bg-accent text-accent-foreground`, `font-medium`, padding `8px 16px` (compact `6px 12px` variant for inline actions like "Add transaction"). Used for Unlock, Create profile, Save, Add transaction.
- **Secondary / Ghost** (`button-secondary`): two variants in use — a bordered version (`border border-border text-muted`, the "Cancel" button) and a borderless text-only version (`text-muted hover:text-foreground`, used for "Back," "Switch profile," "Edit"). Both share the same padding and radius scale as primary.
- **Destructive text action:** `text-muted hover:text-danger`, no fill — the "Delete" button reveals red only on hover/focus, never sits red at rest.
- **Segmented toggle:** the Expense/Income switch is two `flex-1` buttons sharing one row; the active button gets `border-accent bg-accent text-accent-foreground`, with `hover:bg-accent-hover active:bg-accent-active`; the inactive button stays `border-border text-muted` with `hover:border-accent hover:text-foreground active:bg-surface-hover`.
- **Full state set, confirmed:** primary, secondary, ghost-text, and toggle buttons all define default/hover/active/focus-visible/disabled. Primary/secondary hover-active use the dedicated `accent-hover`/`accent-active`/`surface-hover` tokens (deeper for light mode, lighter for dark mode); ghost-text buttons use opacity-dimmed color on active. All color transitions use the `ease-out-quart` token (`cubic-bezier(0.165, 0.84, 0.44, 1)`) at 150ms rather than Tailwind's default ease-in-out.

### Inputs / Fields
- **Style:** `rounded.sm` (8px), `border border-border`, `bg-background`, padding `8px 12px`, `text-base` (16px).
- **Focus:** a 2px solid accent outline with 2px offset (`focus-visible:outline-2 outline-offset-2 outline-accent`) — a native outline, not a box-shadow glow, consistent with Flat-By-Default.
- **Error:** inline `text-sm text-danger` message below the field group, not a red border on the input itself.
- **Select:** same visual treatment as text inputs, native `<select>`.

### Cards / Containers
- **Corner style:** `rounded.lg` (16px) for primary content cards (running-total panel, transaction-list container, profile tile, the floating sheet); `rounded.md` (12px) for the smaller onboarding-copy callout; `rounded.sm` (8px) is reserved for controls, never cards.
- **Background:** `surface` against the page's `background`.
- **Shadow strategy:** none (see Elevation) except the floating sheet.
- **Border:** 1px `border` token on every card.
- **Internal padding:** 24px (`p-6`) for primary cards; 16px×12px for the callout.

### Profile Tile (signature component)
A 144px-wide selectable card: `rounded.lg`, `surface` background, `border`, with a centered 56px circular avatar badge (`bg-accent`, first-letter initial) above the display name. Hover and focus both swap the border to `accent` — the only hover treatment that changes color rather than opacity in the current build. The "Add profile" tile is the same shape with a dashed border and a `+` glyph instead of an avatar.

### Sheet (overlay primitive — `components/ui/Sheet.tsx`)
The single responsive overlay every modal and popover uses, so the whole app shares one overlay vocabulary. Rendered in a portal on `document.body` to escape any clipping/stacking context. Mobile-first: **always a bottom sheet on mobile** (full-width, anchored to the viewport bottom, `rounded-t-card`, with a drag-handle affordance), reshaping on `sm:` and up by `variant`:
- **`modal`** — centers on desktop (`rounded-card`), used by the add/edit-transaction form. The form has a sticky footer so Save/Cancel stay thumb-reachable, and uses `env(safe-area-inset-bottom)` padding.
- **`menu`** — anchors top-right near its trigger on desktop, used by the profile menu. Its scrim dims the screen on mobile but is a transparent click-away layer on desktop.

Scrim is `bg-foreground/20` with `backdrop-blur-sm`. Enter/exit are CSS keyframe animations keyed off a `data-state` (`open`/`closed`) attribute, finalized by `onAnimationEnd`; both honor `prefers-reduced-motion`. Includes Escape-to-close, scrim-click-to-close, body-scroll lock, focus-move-in, and focus-restore-on-close. Uses the semantic z-index scale (`--z-index-modal: 400`), never an arbitrary value.

### Navigation / Profile menu (`components/ui/ProfileMenu.tsx`)
No persistent top/side nav yet (single-screen flows: vault picker → dashboard). The dashboard header carries a **profile menu** trigger (avatar + truncated name + chevron; avatar-only on mobile) that opens a `Sheet` (`menu` variant) holding: the profile identity, the **Appearance** segmented control (Light / Dark / System, with sun/moon/monitor icons), and **Switch profile** (locks the vault, returns to the picker). Re-document once budgets/goals/planner routes introduce real navigation.

## 6. Do's and Don'ts

### Do:
- **Do** keep the accent (teal-green, `oklch(55% 0.12 165)`) to primary actions, the avatar badge, income amounts, and focus rings only — confirmed under 10% of any built screen.
- **Do** keep vault/security copy (profile creation, unlock) plain-spoken and reassuring — the implemented onboarding callout matches the PRD's required copy verbatim.
- **Do** apply `tabular-nums` to every rendered currency amount, as implemented.
- **Do** label every total with its currency (e.g. "TOTAL IDR") — implemented exactly, never a blended figure.
- **Do** use the semantic z-index scale (`--z-index-dropdown/sticky/modal-backdrop/modal/toast/tooltip`) for any new overlay, matching the floating sheet's existing pattern.
- **Do** reserve shadow for genuinely floating elements (the transaction sheet is the only precedent) — new modals, dropdowns, and toasts should follow it; static cards stay flat.

### Don't:
- **Don't** use a navy-and-gold corporate-fintech palette or anything that reads like the Chase or Bank of America app.
- **Don't** build dense, sterile, Excel/Google-Sheets-style tables for transactions or budgets.
- **Don't** use gradient text, glassmorphism as a default, or decorative blur (the one `backdrop-blur-sm` in the build is a functional scrim behind a modal, not decoration).
- **Don't** use side-stripe (`border-left`) colored accents on cards or list items — every border in the build is a full 1px outline.
- **Don't** auto-write AI-proposed plans or extracted receipt data into the UI as if confirmed — not yet applicable to Phase 1, but binding for the upcoming AI planner and receipt-scanning phases.
- **Don't** introduce a second decorative accent color when budgets/goals need a third semantic state (e.g. "warning" for near-budget-limit) — derive it from a deeper neutral step or extend the danger ramp toward amber before reaching for a new hue.
