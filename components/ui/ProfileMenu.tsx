'use client';

import { useId, useState } from 'react';
import { useVault } from '@/lib/vault/VaultContext';
import { useTheme, type Theme } from '@/lib/theme/ThemeContext';
import { Sheet } from './Sheet';

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <SunIcon /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
  { value: 'system', label: 'System', icon: <MonitorIcon /> },
];

export function ProfileMenu() {
  const { activeProfile, lock } = useVault();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const titleId = useId();

  if (!activeProfile) return null;
  const initial = activeProfile.displayName.slice(0, 1).toUpperCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-control border border-border bg-surface py-1.5 pl-1.5 pr-2.5 transition-colors duration-150 ease-out-quart hover:border-accent active:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
          {initial}
        </span>
        <span className="hidden max-w-[10rem] truncate text-label font-medium sm:inline">
          {activeProfile.displayName}
        </span>
        <ChevronIcon />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} variant="menu" labelledBy={titleId}>
        <div className="flex flex-col gap-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {/* Identity */}
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">
              {initial}
            </span>
            <div className="min-w-0">
              <p id={titleId} className="truncate font-medium">
                {activeProfile.displayName}
              </p>
              <p className="truncate text-label text-muted">Vault unlocked on this device</p>
            </div>
          </div>

          {/* Appearance */}
          <div className="flex flex-col gap-2">
            <p className="text-label font-medium text-muted">Appearance</p>
            <div
              role="radiogroup"
              aria-label="Theme"
              className="grid grid-cols-3 gap-1 rounded-control border border-border p-1"
            >
              {THEME_OPTIONS.map((opt) => {
                const selected = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTheme(opt.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-[6px] px-2 py-2.5 text-label transition-colors duration-150 ease-out-quart focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      selected
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted hover:bg-surface-hover hover:text-foreground'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Session */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              lock();
            }}
            className="flex items-center justify-center gap-2 rounded-control border border-border px-4 py-3 text-label font-medium text-muted transition-colors duration-150 ease-out-quart hover:border-accent hover:text-foreground active:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <SwitchIcon />
            Switch profile
          </button>
          <p className="text-center text-micro-label text-muted">
            Locks this vault and returns to the profile picker.
          </p>
        </div>
      </Sheet>
    </>
  );
}

/* --- Icons (inline, 16px, currentColor) ------------------------------- */

function iconProps(size = 16) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

function SunIcon() {
  return (
    <svg {...iconProps(18)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...iconProps(18)}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg {...iconProps(18)}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg {...iconProps(16)} className="text-muted">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SwitchIcon() {
  return (
    <svg {...iconProps(16)}>
      <path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7" />
    </svg>
  );
}
