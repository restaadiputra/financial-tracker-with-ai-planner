'use client';

import { useState } from 'react';
import { fieldClass, primaryButton } from '@/components/ui/controls';

// SIMPLICITY NOTE: chat history is session-only React state, not persisted to
// IndexedDB (see AI Planner design spec "Chat history"). It resets on reload or
// profile switch — the artifact that matters (the tracked goal/budget) persists
// separately via TrackedPlanWidget, so this is an accepted simplicity tradeoff.
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function ChatPanel({
  messages,
  onSend,
  sending,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  sending: boolean;
}) {
  const [draft, setDraft] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setDraft('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
        {messages.length === 0 && (
          <p className="text-body text-muted">
            Tell me a savings goal or ask how your budgets are doing — for example, &ldquo;I want to save
            10 million rupiah this month.&rdquo;
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-callout px-3 py-2 text-body ${
              m.role === 'user' ? 'ml-auto bg-accent text-accent-foreground' : 'bg-background text-foreground'
            }`}
          >
            {m.content}
          </div>
        ))}
        {sending && <p className="text-label text-muted">Thinking…</p>}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className={`flex-1 ${fieldClass}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask the planner…"
          disabled={sending}
          aria-label="Message"
        />
        <button type="submit" className={primaryButton} disabled={sending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
