'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useVault } from '@/lib/vault/VaultContext';
import type { Profile } from '@/lib/db/schema';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { FormError } from '@/components/ui/form';
import { fieldClass as inputClass, ghostButton, primaryButton } from '@/components/ui/controls';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function VaultPage() {
  const { profiles, activeProfile, unlock } = useVault();
  const router = useRouter();
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (activeProfile) {
      router.replace('/dashboard');
    }
  }, [activeProfile, router]);

  if (activeProfile) {
    return null;
  }

  if (creating) {
    return <CreateProfileForm onCancel={() => setCreating(false)} />;
  }

  if (selectedProfile) {
    return (
      <UnlockForm
        profile={selectedProfile}
        unlock={unlock}
        onBack={() => setSelectedProfile(null)}
        onUnlocked={() => router.replace('/dashboard')}
      />
    );
  }

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <div className="text-center">
        <h1 className="text-headline">Who&apos;s tracking today?</h1>
        <p className="mt-2 text-muted">Pick a profile to unlock its local vault.</p>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        {(profiles ?? []).map((profile) => (
          <button
            key={profile.id}
            onClick={() => setSelectedProfile(profile)}
            className="flex w-36 flex-col items-center gap-3 rounded-card border border-border bg-surface px-4 py-6 text-center transition-colors duration-150 ease-out-quart hover:border-accent active:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl font-semibold text-accent-foreground">
              {profile.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="font-medium">{profile.displayName}</span>
          </button>
        ))}

        <button
          onClick={() => setCreating(true)}
          className="flex w-36 flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border px-4 py-6 text-center text-muted transition-colors duration-150 ease-out-quart hover:border-accent hover:text-accent active:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-current text-2xl">+</span>
          <span className="font-medium">Add profile</span>
        </button>
      </div>
    </main>
  );
}

function UnlockForm({
  profile,
  unlock,
  onBack,
  onUnlocked,
}: {
  profile: Profile;
  unlock: (profileId: string, password: string) => Promise<boolean>;
  onBack: () => void;
  onUnlocked: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const ok = await unlock(profile.id, password);
    setSubmitting(false);

    if (!ok) {
      setError('That password doesn’t match this profile’s vault.');
      return;
    }
    onUnlocked();
  }

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <button type="button" onClick={onBack} className={`self-start -ml-2 ${ghostButton}`}>
          &larr; Back
        </button>

        <h1 className="text-title">Unlock {profile.displayName}&apos;s vault</h1>

        <label className="flex flex-col gap-1 text-label">
          Password
          <PasswordInput
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && <FormError>{error}</FormError>}

        <button
          type="submit"
          disabled={submitting || password.length === 0}
          className={`mt-2 ${primaryButton}`}
        >
          {submitting ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </main>
  );
}

function CreateProfileForm({ onCancel }: { onCancel: () => void }) {
  const { addProfile, unlock } = useVault();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!EMAIL_PATTERN.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords don’t match.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters — there’s no way to recover this later.');
      return;
    }

    setSubmitting(true);
    const profile = await addProfile({ displayName, email, password });
    await unlock(profile.id, password);
    setSubmitting(false);
    router.replace('/dashboard');
  }

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
      <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-sm flex-col gap-4">
        <button type="button" onClick={onCancel} className={`self-start -ml-2 ${ghostButton}`}>
          &larr; Back
        </button>

        <h1 className="text-title">Create a profile</h1>

        <p className="rounded-callout border border-border bg-surface px-4 py-3 text-label text-muted">
          This protects your data on this device. We don&apos;t store your password anywhere, and we
          can&apos;t reset it for you. If you forget it, your local data can&apos;t be recovered unless
          you&apos;ve made a backup.
        </p>

        <label className="flex flex-col gap-1 text-label">
          Display name
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={255}
            autoComplete="name"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-label">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            autoComplete="email"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-label">
          Password
          <PasswordInput
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-label">
          Confirm password
          <PasswordInput
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && <FormError>{error}</FormError>}

        <button
          type="submit"
          disabled={submitting}
          className={`mt-2 ${primaryButton}`}
        >
          {submitting ? 'Creating…' : 'Create profile'}
        </button>
      </form>
    </main>
  );
}
