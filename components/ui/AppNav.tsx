'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ProfileMenu } from './ProfileMenu';

const LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/budgets', label: 'Budgets' },
  { href: '/recurring', label: 'Recurring' },
  { href: '/goals', label: 'Goals' },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-sticky border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Horizontal-scroll tab strip keeps all sections reachable on narrow screens. */}
        <nav className="-mb-px flex flex-1 gap-1 overflow-x-auto" aria-label="Sections">
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
        <div className="shrink-0 py-2">
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
