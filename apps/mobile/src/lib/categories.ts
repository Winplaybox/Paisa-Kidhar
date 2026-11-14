export type CategoryKey =
  | 'food' | 'grocery' | 'shopping' | 'subs' | 'travel'
  | 'bills' | 'health' | 'fun' | 'upi' | 'other';

export type Category = { key: CategoryKey; name: string; short: string; emoji: string; color: string };

export const CATEGORIES: Category[] = [
  { key: 'food', name: 'Food & Coffee', short: 'Food', emoji: '☕', color: '#FF8A5B' },
  { key: 'grocery', name: 'Quick Commerce', short: 'Grocery', emoji: '🛒', color: '#FACC15' },
  { key: 'shopping', name: 'Shopping', short: 'Shopping', emoji: '🛍️', color: '#F472B6' },
  { key: 'subs', name: 'Subscriptions', short: 'Subs', emoji: '🔁', color: '#A78BFA' },
  { key: 'travel', name: 'Travel & Fuel', short: 'Travel', emoji: '🛺', color: '#38BDF8' },
  { key: 'bills', name: 'Bills & Rent', short: 'Bills', emoji: '🧾', color: '#94A3B8' },
  { key: 'health', name: 'Health', short: 'Health', emoji: '💊', color: '#34D399' },
  { key: 'fun', name: 'Entertainment', short: 'Fun', emoji: '🎬', color: '#FB7185' },
  { key: 'upi', name: 'Random UPI', short: 'UPI', emoji: '📲', color: '#F59E0B' },
  { key: 'other', name: 'Other', short: 'Other', emoji: '✨', color: '#CBD5E1' },
];

export const CAT: Record<CategoryKey, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<CategoryKey, Category>;

export function cat(key: string | null | undefined): Category {
  return CAT[(key as CategoryKey) ?? 'other'] ?? CAT.other;
}

export const QUICK_ADD: { merchant: string; emoji: string; amount: number; category: CategoryKey }[] = [
  { merchant: 'Coffee', emoji: '☕', amount: 250, category: 'food' },
  { merchant: 'Blinkit', emoji: '🟡', amount: 600, category: 'grocery' },
  { merchant: 'Zepto', emoji: '🟣', amount: 400, category: 'grocery' },
  { merchant: 'Swiggy', emoji: '🍔', amount: 500, category: 'food' },
  { merchant: 'Amazon', emoji: '📦', amount: 1000, category: 'shopping' },
  { merchant: 'Auto / Uber', emoji: '🛺', amount: 200, category: 'travel' },
  { merchant: 'Chai', emoji: '🫖', amount: 20, category: 'food' },
  { merchant: '', emoji: '📲', amount: 0, category: 'upi' },
];
