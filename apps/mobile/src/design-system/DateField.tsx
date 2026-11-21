/* Date input using the platform picker: Android Material dialog, iOS inline spinner. Value is 'YYYY-MM-DD' or ''. */
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Text } from './components';
import { useTheme } from './ThemeProvider';

import { fromISODate, prettyDate, toISODate } from './dateUtils';

export { fromISODate, prettyDate, toISODate };

export function DateField({ label, value, onChange, minimumDate, maximumDate, placeholder = 'Pick a date', error, hint }: {
  label: string; value?: string | null; onChange: (v: string) => void; minimumDate?: Date; maximumDate?: Date;
  placeholder?: string; error?: string | null; hint?: string;
}) {
  const t = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const current = fromISODate(value) ?? minimumDate ?? new Date();

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current, mode: 'date', minimumDate, maximumDate,
        onChange: (e: DateTimePickerEvent, d?: Date) => { if (e.type === 'set' && d) onChange(toISODate(d)); },
      });
    } else setIosOpen((o) => !o);
  };

  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? prettyDate(value) : 'not set'}`}
        style={{
          minHeight: 52, borderRadius: t.radius.md, borderWidth: 2, paddingHorizontal: t.space.lg, flexDirection: 'row', alignItems: 'center', gap: 10,
          borderColor: error ? t.colors.negative : iosOpen ? t.colors.accent : t.colors.border, backgroundColor: t.colors.surface,
        }}>
        <Ionicons name="calendar-outline" size={20} color={t.colors.accent} />
        <Text style={{ flex: 1 }} muted={!value}>{value ? prettyDate(value) : placeholder}</Text>
        {value ? (
          <Pressable onPress={() => onChange('')} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Clear ${label}`}>
            <Ionicons name="close-circle" size={20} color={t.colors.textMuted} />
          </Pressable>
        ) : null}
      </Pressable>
      {iosOpen ? (
        <DateTimePicker value={current} mode="date" display="inline" minimumDate={minimumDate} maximumDate={maximumDate}
          onChange={(_: DateTimePickerEvent, d?: Date) => { if (d) onChange(toISODate(d)); }} accentColor={t.colors.accent} />
      ) : null}
      {error ? <Text variant="caption" color={t.colors.negative}>{error}</Text> : hint ? <Text variant="caption" muted>{hint}</Text> : null}
    </View>
  );
}
