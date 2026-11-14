import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ImportPreview, type PreviewItem } from '@/components/ImportPreview';
import { useToast } from '@/components/Toast';
import { Button, Card, T } from '@/components/ui';
import { useAddTxns } from '@/data/queries';
import { parseStatementFile } from '@/lib/api';
import { dedupeKey, parseCsvStatement } from '@/lib/parser';
import { space, useTheme } from '@/theme/tokens';

const MAX_BYTES = 8 * 1024 * 1024;

export default function ImportStatement() {
  const t = useTheme();
  const toast = useToast();
  const add = useAddTxns();
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<PreviewItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [source, setSource] = useState<'csv' | 'pdf'>('csv');

  const pick = async () => {
    setErr(null);
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (a.size && a.size > MAX_BYTES) { setErr('File 8MB se badi hai'); return; }
    const name = a.name.toLowerCase();
    setBusy(true);
    try {
      if (name.endsWith('.csv') || name.endsWith('.txt')) {
        setSource('csv');
        const text = await new File(a.uri).text();
        const r = parseCsvStatement(text);
        if (r.error) throw new Error(r.error);
        if (!r.items.length) throw new Error('Koi debit entry nahi mili');
        setItems(r.items.map((i) => ({ ...i, use: true })));
      } else {
        setSource('pdf');
        const parsed = await parseStatementFile({ uri: a.uri, name: a.name, mimeType: a.mimeType });
        if (!parsed.length) throw new Error('Koi debit entry nahi mili. Password-protected PDF ho toh pehle unlock karo.');
        setItems(parsed.map((i) => ({ ...i, use: true })));
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const importNow = () => {
    const rows = (items ?? []).filter((i) => i.use).map((i) => ({
      amount: i.amount, merchant: i.merchant, category: i.category,
      occurred_at: new Date(i.occurredAt).toISOString(), source, dedupe_key: dedupeKey(i, source),
    }));
    add.mutate(rows, {
      onSuccess: (r) => toast(r.inserted < rows.length ? `${r.inserted} add hue, ${rows.length - r.inserted} pehle se the` : `${r.inserted} kharche import hue ✓`),
      onError: (e) => toast(e.message),
    });
    router.back();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.card }} contentContainerStyle={{ padding: space.xl, paddingTop: space.xxl, paddingBottom: 60 }}>
      <T v="h2">Bank statement import 📄</T>
      <T v="caption" muted style={{ marginTop: 4, marginBottom: space.lg }}>
        Net banking se statement download karo — CSV, Excel ya PDF. HDFC, ICICI, SBI, Axis, Kotak sab chalega. Sirf debit entries aayengi.
      </T>
      <Button title={busy ? 'Padh raha hoon…' : 'File choose karo'} icon="📂" onPress={pick} loading={busy} />
      {err ? (
        <Card style={{ marginTop: space.md, borderColor: t.danger + '66' }}>
          <T v="bodyStrong" color={t.danger}>Import nahi hua</T>
          <T v="caption" muted>{err}</T>
        </Card>
      ) : null}
      {items ? <ImportPreview items={items} onChange={setItems} onImport={importNow} busy={add.isPending} /> : (
        <View style={{ marginTop: space.xl, gap: 8 }}>
          <T v="caption" muted>• CSV: phone pe hi parse hota hai (fast, offline)</T>
          <T v="caption" muted>• PDF / Excel: secure server pe parse hota hai, file save nahi hoti</T>
          <T v="caption" muted>• Same entry dobara import karne pe duplicate nahi banega</T>
        </View>
      )}
    </ScrollView>
  );
}
