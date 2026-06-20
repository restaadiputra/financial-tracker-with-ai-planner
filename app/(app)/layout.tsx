'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useVault } from '@/lib/vault/VaultContext';
import { db } from '@/lib/db/db';
import { generateDueTransactions } from '@/lib/recurring/generateDueTransactions';
import { AppNav } from '@/components/ui/AppNav';

// Hourly re-check while the app stays open, so a long-lived session still
// materialises recurring transactions when a new day rolls over (PRD 5.4).
const RECURRING_CHECK_MS = 60 * 60 * 1000;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { activeProfile, vaultKey } = useVault();
  const router = useRouter();

  // Single auth guard for every authenticated page — locked vault returns to the picker.
  useEffect(() => {
    if (!activeProfile || !vaultKey) router.replace('/');
  }, [activeProfile, vaultKey, router]);

  // Lazy recurring-transaction generation: on load and once per hour thereafter.
  // generateDueTransactions is idempotent, so the interval is safe to re-run.
  useEffect(() => {
    if (!activeProfile || !vaultKey) return;
    const run = () => {
      void generateDueTransactions(db, vaultKey, activeProfile.id).catch(() => {});
    };
    run();
    const interval = setInterval(run, RECURRING_CHECK_MS);
    return () => clearInterval(interval);
  }, [activeProfile, vaultKey]);

  if (!activeProfile || !vaultKey) return null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppNav />
      {children}
    </div>
  );
}
