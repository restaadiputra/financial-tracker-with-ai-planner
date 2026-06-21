'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type SheetVariant = 'modal' | 'menu';

/**
 * One responsive overlay for the whole app. On mobile it is always a
 * bottom sheet (thumb-reachable, full-width, with a drag-handle affordance);
 * on >=sm a `modal` centers and a `menu` anchors to the top-right near its
 * trigger. Scrim-click and Escape close it, body scroll is locked while open,
 * focus moves in and is restored on close, and enter/exit are CSS keyframe
 * animations (data-state open|closed) finalized by onAnimationEnd — so every
 * modal and popover behaves identically. See DESIGN.md "Floating Sheet".
 */
export function Sheet({
  open,
  onClose,
  variant = 'modal',
  labelledBy,
  className = '',
  children,
}: {
  open: boolean;
  onClose: () => void;
  variant?: SheetVariant;
  labelledBy?: string;
  className?: string;
  children: React.ReactNode;
}) {
  // Derive "is the panel in the DOM?" from `open` during render (no effect):
  // opening mounts immediately; closing keeps it mounted so the exit
  // animation can play, then onAnimationEnd flips `render` off.
  const [render, setRender] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setRender(true);
  }

  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Capture the trigger to restore focus to it after close.
  useEffect(() => {
    if (open) restoreFocusRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  // Move focus into the panel once it is in the DOM and opening.
  useEffect(() => {
    if (!render || !open) return;
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
    );
    (focusable ?? panelRef.current)?.focus();
  }, [render, open]);

  // Lock body scroll while the panel is mounted.
  useEffect(() => {
    if (!render) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [render]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  // When the panel's own exit animation finishes, unmount and hand focus back.
  // Ignore animationend events bubbling up from descendants.
  const handleAnimationEnd = useCallback(
    (e: React.AnimationEvent) => {
      if (e.target !== e.currentTarget) return;
      if (!open) {
        setRender(false);
        restoreFocusRef.current?.focus?.();
      }
    },
    [open]
  );

  if (!render || typeof document === 'undefined') return null;

  const state = open ? 'open' : 'closed';

  // Mobile is a bottom sheet for both variants. On >=sm the modal centers and
  // the menu pins to the top-right (near the dashboard's profile trigger).
  const containerAlign =
    variant === 'menu'
      ? 'items-end justify-center sm:items-start sm:justify-end sm:p-4'
      : 'items-end justify-center sm:items-center sm:p-4';

  // The menu's scrim dims the whole screen on mobile but is a plain click-away
  // layer on desktop, so a quick popover doesn't darken the page.
  const scrimTone =
    variant === 'menu'
      ? 'bg-foreground/20 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none'
      : 'bg-foreground/20 backdrop-blur-sm';

  // SIMPLICITY NOTE: panel width is capped (320px menu / 448px modal) instead of
  // scaling up on wide desktop viewports. Every form here collects a handful of
  // fields (amount, category, date, note) — a single focused column, not a dense
  // dashboard — so a wider panel would add empty space, not utility. Deliberately
  // not responsive beyond mobile vs. everything-else. Revisit only if a future
  // form needs multi-column layout (none currently do).
  const panelWidth = variant === 'menu' ? 'w-full sm:w-80' : 'w-full sm:max-w-md';

  return createPortal(
    <div className={`fixed inset-0 z-modal flex ${containerAlign}`}>
      <div
        className={`sheet-scrim absolute inset-0 ${scrimTone}`}
        data-state={state}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onAnimationEnd={handleAnimationEnd}
        data-variant={variant}
        data-state={state}
        className={`sheet-panel relative max-h-[90dvh] overflow-y-auto rounded-t-card border border-border bg-background shadow-lg outline-none sm:rounded-card ${panelWidth} ${className}`}
      >
        {/* Drag-handle affordance: signals "sheet" on mobile, hidden on desktop. */}
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-border" />
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
