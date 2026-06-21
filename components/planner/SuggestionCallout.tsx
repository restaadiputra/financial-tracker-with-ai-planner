'use client';

import { useEffect, useState } from 'react';
import { secondaryButton } from '@/components/ui/controls';

// PRD Section 6.4: proactive suggestions are a manual, debounced refresh, never
// an automatic call on every transaction/render. The page owns the actual
// once-per-hour gate (via localStorage); this component just disables the
// button and shows when it'll be available again.
export function SuggestionCallout({
  suggestion,
  onRefresh,
  canRefreshAt,
  loading,
}: {
  suggestion: string | null;
  onRefresh: () => void;
  canRefreshAt: number;
  loading: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const canRefresh = now >= canRefreshAt;

  return (
    <div className="flex flex-col gap-3 rounded-callout border border-border bg-surface p-4">
      <p className="text-body text-foreground">
        {suggestion ?? 'Get a concrete suggestion based on your current progress.'}
      </p>
      <button
        type="button"
        className={`${secondaryButton} self-start`}
        onClick={onRefresh}
        disabled={!canRefresh || loading}
      >
        {loading
          ? 'Thinking…'
          : canRefresh
            ? 'Get updated suggestion'
            : `Next refresh at ${new Date(canRefreshAt).toLocaleTimeString()}`}
      </button>
    </div>
  );
}
