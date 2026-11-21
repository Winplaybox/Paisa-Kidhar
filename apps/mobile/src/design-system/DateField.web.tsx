/* Web: the browser's native date picker (<input type="date">), styled like Field. Value is 'YYYY-MM-DD' or ''. */
import { createElement } from 'react';
import { View } from 'react-native';

import { Text } from './components';
import { useTheme } from './ThemeProvider';

export { fromISODate, prettyDate, toISODate } from './dateUtils';
import { toISODate } from './dateUtils';

export function DateField({ label, value, onChange, minimumDate, maximumDate, error, hint }: {
  label: string; value?: string | null; onChange: (v: string) => void; minimumDate?: Date; maximumDate?: Date;
  placeholder?: string; error?: string | null; hint?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      {createElement('input', {
        type: 'date', value: value ?? '', 'aria-label': label,
        min: minimumDate ? toISODate(minimumDate) : undefined, max: maximumDate ? toISODate(maximumDate) : undefined,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        style: {
          minHeight: 52, borderRadius: t.radius.md, border: `2px solid ${error ? t.colors.negative : t.colors.border}`, padding: '0 16px',
          background: t.colors.surface, color: t.colors.text, fontFamily: t.font.body, fontSize: t.size.md, colorScheme: t.scheme, outline: 'none',
          boxSizing: 'border-box', width: '100%',
        },
      })}
      {error ? <Text variant="caption" color={t.colors.negative}>{error}</Text> : hint ? <Text variant="caption" muted>{hint}</Text> : null}
    </View>
  );
}
