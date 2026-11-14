import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput } from 'react-native';

import { ImportPreview, type PreviewItem } from '@/components/ImportPreview';
import { useToast } from '@/components/Toast';
import { Button, Row, T } from '@/components/ui';
import { useAddTxns } from '@/data/queries';
import { dedupeKey, parseSmsBatch } from '@/lib/parser';
import { font, radius, space, useTheme } from '@/theme/tokens';

const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(2)}`;
};

const SAMPLE = () => `Rs.250.00 debited from A/c XX1234 on ${today()} to VPA starbucks.mumbai@hdfcbank (UPI Ref No 612345). Avl Bal Rs 45,210.00

INR 600.00 spent on HDFC Bank Card XX1234 at BLINKIT on ${new Date().toISOString().slice(0, 10)}. Avl Lmt: INR 1,20,000

Dear UPI user A/C X1234 debited by 500.0 on date ${today()} trf to SWIGGY Refno 98765 -SBI

Rs.50000.00 credited to your A/c XX1234 by NEFT SALARY`;

export default function ImportSms() {
  const t = useTheme();
  const toast = useToast();
  const add = useAddTxns();
  const [text, setText] = useState('');
  const [items, setItems] = useState<PreviewItem[] | null>(null);

  const parse = (src = text) => {
    const parsed = parseSmsBatch(src);
    if (!parsed.length) { toast('Pehle SMS paste karo'); return; }
    setItems(parsed.map((p) => ({ ...p, use: p.ok })));
  };

  const paste = async () => {
    const s = await Clipboard.getStringAsync().catch(() => '');
    if (!s.trim()) { toast('Clipboard khaali hai — Messages app se SMS copy karo'); return; }
    setText(s);
    parse(s);
  };

  const importNow = () => {
    const rows = (items ?? []).filter((i) => i.ok && i.use).map((i) => ({
      amount: i.amount, merchant: i.merchant, category: i.category,
      occurred_at: new Date(i.occurredAt).toISOString(), source: 'sms' as const, dedupe_key: dedupeKey(i, 'sms'),
    }));
    add.mutate(rows, {
      onSuccess: (r) => toast(r.inserted < rows.length ? `${r.inserted} add hue, ${rows.length - r.inserted} pehle se the` : `${r.inserted} kharche add hue ✓`),
      onError: (e) => toast(e.message),
    });
    router.back();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.card }} contentContainerStyle={{ padding: space.xl, paddingTop: space.xxl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <T v="h2">Bank SMS se import 📩</T>
      <T v="caption" muted style={{ marginTop: 4, marginBottom: space.lg }}>
        Messages app mein debit SMS long-press → Copy karo, phir yahan paste. Ek ya bahut saare ek saath. Amount, merchant, date aur category khud nikal aayenge.
      </T>
      <TextInput
        value={text} onChangeText={setText} multiline textAlignVertical="top" placeholderTextColor={t.textFaint}
        placeholder={'Rs.250.00 debited from A/c XX1234 on 15-11-26 to VPA starbucks@hdfcbank…'}
        style={{ minHeight: 150, maxHeight: 260, color: t.text, backgroundColor: t.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: t.line, padding: 14, fontFamily: font.body, fontSize: 13.5 }}
      />
      <Row gap={8} style={{ marginTop: space.md }}>
        <Button kind="soft" title="Paste" icon="📋" onPress={paste} style={{ flex: 1 }} />
        <Button title="Parse karo →" onPress={() => parse()} style={{ flex: 1.4 }} />
      </Row>
      {!items ? (
        <Button kind="ghost" title="Sample SMS se try karo" onPress={() => { const s = SAMPLE(); setText(s); parse(s); }} style={{ marginTop: space.sm }} />
      ) : (
        <ImportPreview items={items} onChange={setItems} onImport={importNow} busy={add.isPending} />
      )}
      <T v="caption" muted center style={{ marginTop: space.xl }}>🔒 SMS sirf tumhare phone pe parse hota hai. Sirf amount, merchant, date save hote hain.</T>
    </ScrollView>
  );
}
