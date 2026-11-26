import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STREAK_KEY = 'pk.streak.v1';
const GUIDE_KEY = 'pk.onboarding_hidden.v1';

const isoDay = (d = new Date()) => d.toISOString().slice(0, 10);

/** Days until an ISO date (YYYY-MM-DD). Returns null for invalid/past dates (< 0). */
export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const target = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return null;
  const today = new Date(`${isoDay()}T00:00:00Z`).getTime();
  const diff = Math.round((target - today) / 86_400_000);
  return diff >= 0 ? diff : null;
}

/** Tracks daily check-in streak locally in AsyncStorage. */
export function useCheckInStreak(): number {
  const [streak, setStreak] = useState(1);
  useEffect(() => {
    (async () => {
      try {
        const today = isoDay();
        const yesterday = isoDay(new Date(Date.now() - 86_400_000));
        const raw = await AsyncStorage.getItem(STREAK_KEY);
        const prev = raw ? (JSON.parse(raw) as { lastDay: string; count: number }) : null;
        if (prev?.lastDay === today) { setStreak(prev.count); return; }
        const nextCount = prev?.lastDay === yesterday ? prev.count + 1 : 1;
        setStreak(nextCount);
        await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ lastDay: today, count: nextCount }));
      } catch { /* ignore storage errors */ }
    })();
  }, []);
  return streak;
}

/** Persists whether the couple dismissed the Quick Start onboarding checklist. */
export function useOnboardingGuide() {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(GUIDE_KEY).then((v) => setHidden(v === '1')).catch(() => setHidden(false));
  }, []);
  const dismiss = () => { setHidden(true); AsyncStorage.setItem(GUIDE_KEY, '1').catch(() => {}); };
  return { hidden, dismiss };
}
