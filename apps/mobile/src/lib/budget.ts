/** Budget math. All dates are device-local. */
export type Profile = {
  id: string;
  display_name: string | null;
  monthly_income: number;
  fixed_costs: number;
  budget_mode: 'full' | 'after_fixed';
  rollover: boolean;
  report_hour: number;
  morning_hour: number;
  notifications: boolean;
  timezone: string;
  created_at: string;
};

export type Txn = {
  id: string;
  amount: number;
  category: string;
  merchant: string;
  note: string | null;
  occurred_at: string;
  source: string;
};

export const pad = (n: number) => String(n).padStart(2, '0');
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const dayKey = (d: Date) => `${monthKey(d)}-${pad(d.getDate())}`;
export const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const fromMonthKey = (k: string) => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1); };

export function monthlySpendable(p: Pick<Profile, 'monthly_income' | 'fixed_costs' | 'budget_mode'>): number {
  const inc = Number(p.monthly_income) || 0;
  const fx = Number(p.fixed_costs) || 0;
  return p.budget_mode === 'after_fixed' ? Math.max(0, inc - fx) : inc;
}

export const baseDaily = (p: Pick<Profile, 'monthly_income' | 'fixed_costs' | 'budget_mode'>, d: Date) =>
  monthlySpendable(p) / daysInMonth(d);

export function spentOn(txns: Txn[], d: Date): number {
  const k = dayKey(d);
  let s = 0;
  for (const t of txns) if (dayKey(new Date(t.occurred_at)) === k) s += Number(t.amount);
  return s;
}

export function totalsByDay(txns: Txn[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of txns) {
    const k = dayKey(new Date(t.occurred_at));
    m.set(k, (m.get(k) ?? 0) + Number(t.amount));
  }
  return m;
}

/** Today's budget incl. carry-forward from earlier days this month (since signup). */
export function dayBudget(p: Profile, monthTxns: Txn[], d: Date): { base: number; carry: number; total: number } {
  const base = baseDaily(p, d);
  if (!p.rollover) return { base, carry: 0, total: base };
  const created = new Date(p.created_at);
  const startDay = monthKey(created) === monthKey(d) ? created.getDate() : 1;
  const byDay = totalsByDay(monthTxns);
  let carry = 0;
  for (let day = startDay; day < d.getDate(); day++) {
    const dd = new Date(d.getFullYear(), d.getMonth(), day);
    carry += base - (byDay.get(dayKey(dd)) ?? 0);
  }
  return { base, carry, total: base + carry };
}

export type Grade = { grade: string; line: string; tone: 'good' | 'ok' | 'warn' | 'bad'; emoji: string };

export function gradeFor(spent: number, budget: number): Grade {
  if (spent <= 0) return { grade: 'A+', line: 'Zero kharcha! Ya toh tu saint hai, ya entry bhool gaya 🤨', tone: 'good', emoji: '😇' };
  const r = budget > 0 ? spent / budget : 9;
  if (r <= 0.5) return { grade: 'A+', line: 'Bhai tu toh Warren Buffett nikla. Aaj paisa bacha, respect.', tone: 'good', emoji: '🧘' };
  if (r <= 0.85) return { grade: 'A', line: 'Budget mein, aur thoda bacha bhi. Aise hi chalta reh.', tone: 'good', emoji: '😎' };
  if (r <= 1.0) return { grade: 'B', line: 'Just about budget mein. Tightrope walker energy.', tone: 'ok', emoji: '🎪' };
  if (r <= 1.3) return { grade: 'C', line: 'Thoda zyada ho gaya. Kal Blinkit ko thoda rest de.', tone: 'warn', emoji: '😬' };
  if (r <= 2.0) return { grade: 'D', line: "Bro, you're literally working to fund your own bad decisions.", tone: 'bad', emoji: '💸' };
  return { grade: 'F', line: 'Salary aayi thi ya sapna tha? Wallet ICU mein hai.', tone: 'bad', emoji: '🚑' };
}

export function greeting(name?: string | null, now = new Date()): string {
  const h = now.getHours();
  const n = name ? `, ${name}` : '';
  if (h < 12) return `Good morning${n} ☀️`;
  if (h < 17) return `Good afternoon${n} 🌤️`;
  if (h < 21) return `Good evening${n} 🌆`;
  return `Raat ho gayi${n} 🌙`;
}

/** Consecutive days (ending yesterday) spent within base daily budget, since signup. */
export function streak(p: Profile, daily: Map<string, number>, now = new Date()): number {
  const created = startOfDay(new Date(p.created_at));
  let n = 0;
  let d = addDays(startOfDay(now), -1);
  for (let i = 0; i < 180 && d >= created; i++) {
    if ((daily.get(dayKey(d)) ?? 0) <= baseDaily(p, d)) n++;
    else break;
    d = addDays(d, -1);
  }
  return n;
}
