'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, Repeat, Target, Sparkles } from 'lucide-react';
import { ProfileMenu } from './ProfileMenu';

const LINKS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/budgets', label: 'Budgets', icon: Wallet },
  { href: '/recurring', label: 'Recurring', icon: Repeat },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/planner', label: 'Planner', icon: Sparkles },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-sticky border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* Horizontal-scroll tab strip — confirmed to fit comfortably at >=sm;
              below that the bottom tab bar (see end of this component) takes over,
              since 4 links don't fit a top strip on a 375px screen without
              scrolling 2 of them off-screen with no affordance. */}
          <nav className="-mb-px hidden flex-1 gap-1 overflow-x-auto sm:flex" aria-label="Sections">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap border-b-2 px-3 py-3.5 text-label font-medium transition-colors duration-150 ease-out-quart focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    active
                      ? 'border-accent text-foreground'
                      : 'border-transparent text-muted hover:text-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto shrink-0 py-2 sm:ml-0">
            <ProfileMenu />
          </div>
        </div>
      </header>

      {/* Fixed bottom tab bar: mobile-only replacement for the top strip, thumb-reachable
          and matching the Mint/Monarch-style reference cited in PRODUCT.md. Active state
          is accent-colored icon+label (no underline — that idiom doesn't read well anchored
          to a bottom edge) so it's visually distinct from the top strip's treatment. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-sticky flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
        aria-label="Sections"
      >
        {LINKS.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors duration-150 ease-out-quart focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active ? 'text-accent' : 'text-muted hover:text-foreground'
              }`}
            >
              <Icon size={22} strokeWidth={2} aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
