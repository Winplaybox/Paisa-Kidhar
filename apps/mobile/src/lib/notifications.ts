/**
 * Local notifications — no server, no push token, works offline.
 * Re-planned every time data changes, so tonight's report carries the real numbers.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, baseDaily, dayBudget, gradeFor, spentOn, startOfDay, type Profile, type Txn } from './budget';
import { inr } from './format';

const CHANNEL = 'daily-budget';
const TAG = 'pk';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(ask: boolean): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Daily budget & report card',
      importance: Notifications.AndroidImportance.DEFAULT, // eslint-disable-line import/namespace
    });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!ask || !cur.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

let planning: Promise<void> | null = null;

/** Debounced/serialized so rapid adds don't race. */
export function planNotifications(p: Profile, monthTxns: Txn[]): Promise<void> {
  const run = async () => {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all.filter((n) => (n.content.data as { tag?: string } | null)?.tag === TAG)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    if (!p.notifications) return;
    const granted = (await Notifications.getPermissionsAsync()).granted;
    if (!granted) return;

    const now = new Date();
    const today = startOfDay(now);
    const jobs: Promise<string>[] = [];
    const at = (d: Date, h: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0, 0);

    for (let i = 0; i < 7; i++) {
      const day = addDays(today, i);
      const isToday = i === 0;

      // Morning: "Good morning. Your daily income budget is ₹3,333."
      const morning = at(day, p.morning_hour);
      if (morning > now) {
        const b = i <= 1 ? dayBudget(p, monthTxns, day).total : baseDaily(p, day);
        jobs.push(schedule(morning, 'Good morning ☀️', `Aaj ka daily income budget ${inr(b)} hai. Soch samajh ke kharch karna 😉`, 'morning'));
      }

      // Night: report card
      const night = at(day, p.report_hour);
      if (night > now) {
        if (isToday) {
          const budget = dayBudget(p, monthTxns, day).total;
          const spent = spentOn(monthTxns, day);
          const g = gradeFor(spent, budget);
          const title = spent > budget ? `Report card: ${g.grade} ${g.emoji}` : `Congratulations 🎉 Grade ${g.grade}`;
          const body = `Aaj ka budget ${inr(budget)} tha, aur tumne ${inr(spent)} kharch kiye. ${g.line}`;
          jobs.push(schedule(night, title, body, 'report'));
        } else {
          jobs.push(schedule(night, 'Aaj ka report card ready hai 🌙', 'Dekh lo aaj kitna bura (ya accha) behave kiya 😅', 'report'));
        }
      }
    }
    await Promise.all(jobs);
  };
  planning = (planning ?? Promise.resolve()).then(run, run).catch(() => undefined);
  return planning;
}

function schedule(date: Date, title: string, body: string, kind: 'morning' | 'report') {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { tag: TAG, kind, url: kind === 'report' ? '/report' : '/' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
  });
}

export async function cancelAllPlanned() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
