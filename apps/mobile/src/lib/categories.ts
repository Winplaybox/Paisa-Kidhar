/* Goal categories come from the API (paisa.categories) so new ones need no app release.
   FALLBACK keeps the editor usable offline / before the first fetch. */
import type Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { api, type CategoryInfo } from './api';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const FALLBACK_CATEGORIES: CategoryInfo[] = [
  { key: 'honeymoon', label: 'Honeymoon', icon: 'airplane-outline' },
  { key: 'home', label: 'First home', icon: 'home-outline' },
  { key: 'travel', label: 'Travel', icon: 'map-outline' },
  { key: 'experience', label: 'Experience', icon: 'sparkles-outline' },
  { key: 'item', label: 'Something we need', icon: 'gift-outline' },
  { key: 'savings', label: 'Savings', icon: 'wallet-outline' },
  { key: 'other', label: 'Other', icon: 'heart-outline' },
];

export function useCategories() {
  const q = useQuery({ queryKey: ['categories'], queryFn: api.categories, staleTime: 6 * 60 * 60 * 1000 });
  return q.data?.categories?.length ? q.data.categories : FALLBACK_CATEGORIES;
}

export function categoryIcon(list: CategoryInfo[], key: string): IconName {
  return ((list.find((c) => c.key === key)?.icon ?? 'heart-outline') as IconName);
}

export function categoryLabel(list: CategoryInfo[], key: string, custom?: string | null): string {
  return custom || list.find((c) => c.key === key)?.label || 'Other';
}
