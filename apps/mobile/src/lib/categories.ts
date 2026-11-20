import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { Category } from './api';

export const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'honeymoon', label: 'Honeymoon' },
  { key: 'home', label: 'First home' },
  { key: 'travel', label: 'Travel' },
  { key: 'experience', label: 'Experience' },
  { key: 'item', label: 'Something we need' },
  { key: 'savings', label: 'Savings' },
  { key: 'other', label: 'Other' },
];

export const CATEGORY_ICON: Record<Category, ComponentProps<typeof Ionicons>['name']> = {
  honeymoon: 'airplane-outline',
  home: 'home-outline',
  travel: 'map-outline',
  experience: 'sparkles-outline',
  item: 'gift-outline',
  savings: 'wallet-outline',
  other: 'heart-outline',
};
