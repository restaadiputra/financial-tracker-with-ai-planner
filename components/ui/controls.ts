// Shared control styles for Phase 2 forms/pages, matching the inline classes the
// Phase 1 dashboard and TransactionForm already use — kept in one place so the
// budgets/recurring/goals/net-worth surfaces stay visually identical without
// re-typing the long token strings.

export const fieldClass =
  'rounded-control border border-border bg-background px-3 py-2.5 text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const primaryButton =
  'rounded-control bg-accent px-4 py-2.5 text-label font-medium text-accent-foreground transition-colors duration-150 ease-out-quart hover:bg-accent-hover active:bg-accent-active disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const secondaryButton =
  'rounded-control border border-border px-4 py-2.5 text-label font-medium text-muted transition-colors duration-150 ease-out-quart hover:border-accent hover:text-foreground active:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const dangerButton =
  'rounded-control bg-danger px-2.5 py-1.5 text-label font-medium text-danger-foreground transition-opacity duration-150 ease-out-quart hover:opacity-90 active:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger';

export const ghostButton =
  'rounded-control px-2 py-1.5 text-label text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
