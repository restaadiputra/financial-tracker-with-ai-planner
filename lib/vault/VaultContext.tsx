'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import type { Profile } from '@/lib/db/schema';
import { seedDefaultCategories } from '@/lib/db/categories';
import { createInactivityTimer } from './inactivityTimer';
import { createProfile, type CreateProfileInput, unlockProfile } from './vault';

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown'] as const;

interface VaultContextValue {
  profiles: Profile[] | undefined;
  activeProfile: Profile | null;
  vaultKey: CryptoKey | null;
  unlock: (profileId: string, password: string) => Promise<boolean>;
  lock: () => void;
  addProfile: (input: CreateProfileInput) => Promise<Profile>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const profiles = useLiveQuery(() => db.profiles.toArray(), []);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);

  const lock = useCallback(() => {
    setActiveProfile(null);
    setVaultKey(null);
  }, []);

  const timerRef = useRef(createInactivityTimer(SESSION_TIMEOUT_MS, lock));

  useEffect(() => {
    const timer = timerRef.current;

    if (!activeProfile) {
      timer.clear();
      return;
    }

    timer.reset();
    const resetTimer = () => timer.reset();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      timer.clear();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [activeProfile]);

  const unlock = useCallback(async (profileId: string, password: string) => {
    const key = await unlockProfile(db, profileId, password);
    if (!key) return false;

    const profile = await db.profiles.get(profileId);
    setVaultKey(key);
    setActiveProfile(profile ?? null);
    return true;
  }, []);

  const addProfile = useCallback(async (input: CreateProfileInput) => {
    const profile = await createProfile(db, input);
    await seedDefaultCategories(db, profile.id);
    return profile;
  }, []);

  const value = useMemo(
    () => ({ profiles, activeProfile, vaultKey, unlock, lock, addProfile }),
    [profiles, activeProfile, vaultKey, unlock, lock, addProfile]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext);
  if (!context) throw new Error('useVault must be used within a VaultProvider');
  return context;
}
