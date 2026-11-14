import { StyleSheet, Text, View } from 'react-native';

import { T, Tap } from '@/components/ui';
import { CATEGORIES, type CategoryKey } from '@/lib/categories';
import { font, radius, useTheme } from '@/theme/tokens';

export function CategoryPicker({ value, onChange }: { value: CategoryKey; onChange: (k: CategoryKey) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {CATEGORIES.map((c) => {
        const sel = c.key === value;
        return (
          <Tap key={c.key} onPress={() => onChange(c.key)} accessibilityState={{ selected: sel }} accessibilityLabel={c.name}
            style={{
              width: '18.8%', paddingVertical: 9, borderRadius: radius.md, alignItems: 'center', gap: 2,
              backgroundColor: sel ? c.color + '2E' : t.bgElevated, borderWidth: sel ? 1.5 : StyleSheet.hairlineWidth, borderColor: sel ? c.color : t.line,
            }}>
            <Text style={{ fontSize: 18 }}>{c.emoji}</Text>
            <T v="caption" numberOfLines={1} color={sel ? t.text : t.textMuted} style={{ fontSize: 10.5, fontFamily: sel ? font.bodySemi : font.bodyMedium }}>{c.short}</T>
          </Tap>
        );
      })}
    </View>
  );
}
