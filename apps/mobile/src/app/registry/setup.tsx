import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { Banner, Button, Card, Chip, Field, Row, Screen, Text } from '@/design-system/components';
import { registryThemeNames, registryThemeSwatch } from '@/design-system/theme';
import { DateField } from '@/design-system/DateField';
import { useTheme } from '@/design-system/ThemeProvider';
import type { RegistryInput, RegistryTheme } from '@/lib/api';
import { useI18n } from '@/i18n';
import { config } from '@/lib/config';
import { errorMessage, useCreateRegistry, useRegistry, useUpdateRegistry } from '@/lib/queries';

const VPA = /^[a-zA-Z0-9.\-_]{2,128}@[a-zA-Z][a-zA-Z0-9]{1,64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function RegistrySetup() {
  const t = useTheme();
  const { t: tx } = useI18n();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRegistry(id);
  const create = useCreateRegistry();
  const update = useUpdateRegistry(id ?? '');
  const [f, setF] = useState<RegistryInput>({ partner_one: '', partner_two: '', wedding_date: '', city: '', story: '', upi_vpa: '', upi_payee_name: '', theme: 'rose', show_progress: true });
  const [err, setErr] = useState<string | null>(null);
  const r = existing.data;
  useEffect(() => {
    if (r) setF({ partner_one: r.partner_one, partner_two: r.partner_two, wedding_date: r.wedding_date ?? '', city: r.city ?? '', story: r.story,
      upi_vpa: r.upi_vpa ?? '', upi_payee_name: r.upi_payee_name ?? '', theme: r.theme, slug: r.slug, show_progress: r.show_progress });
  }, [r]);
  const set = (k: keyof RegistryInput) => (v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const premium = r?.plan === 'premium';
  const rtLabel = (th: string) => { const k = 'rt_' + th; const v = tx(k); return v !== k ? v : th[0].toUpperCase() + th.slice(1); };

  const errors = {
    upi: f.upi_vpa && !VPA.test(f.upi_vpa.trim()) ? tx('rs_upi_err') : null,
    date: f.wedding_date && !DATE.test(f.wedding_date) ? tx('rs_err_date') : null,
  };

  const submit = () => {
    setErr(null);
    if (!f.partner_one?.trim() || !f.partner_two?.trim()) { setErr(tx('rs_err_names')); return; }
    if (errors.upi || errors.date) { setErr(tx('rs_err_fix')); return; }
    const body: RegistryInput = {
      partner_one: f.partner_one.trim(), partner_two: f.partner_two!.trim(), wedding_date: f.wedding_date || null, city: f.city?.trim() || null,
      story: f.story ?? '', upi_vpa: f.upi_vpa?.trim() || null, upi_payee_name: f.upi_payee_name?.trim() || null, show_progress: f.show_progress,
    };
    if (premium) { body.theme = f.theme; if (f.slug && f.slug !== r?.slug) body.slug = f.slug.trim().toLowerCase(); }
    const opts = { onSuccess: () => router.back(), onError: (e: unknown) => setErr(errorMessage(e)) };
    if (id) update.mutate(body, opts); else create.mutate(body, { ...opts, onSuccess: () => router.replace('/goals') });
  };

  return (
    <Screen>
      <Text variant="title">{id ? tx('rs_edit') : tx('rs_create')}</Text>
      {err ? <Banner tone="negative" title={err} /> : null}
      <Card style={{ gap: t.space.lg }}>
        <Row gap={t.space.md} wrap>
          <View style={{ flex: 1, minWidth: 220 }}><Field label={tx('rs_p1')} value={f.partner_one} onChangeText={set('partner_one')} placeholder="Riya" autoComplete="name" /></View>
          <View style={{ flex: 1, minWidth: 220 }}><Field label={tx('rs_p2')} value={f.partner_two} onChangeText={set('partner_two')} placeholder="Arjun" /></View>
        </Row>
        <Row gap={t.space.md} wrap>
          <View style={{ flex: 1, minWidth: 220 }}><DateField label={tx('rs_date')} value={f.wedding_date} onChange={set('wedding_date')} error={errors.date} /></View>
          <View style={{ flex: 1, minWidth: 220 }}><Field label={tx('rs_city')} value={f.city ?? ''} onChangeText={set('city')} placeholder="Mumbai" autoComplete="postal-address-locality" /></View>
        </Row>
        <Field label={tx('rs_story')} value={f.story} onChangeText={set('story')} multiline maxLength={1200}
          placeholder={tx('rs_story_ph')} />
      </Card>

      <Card style={{ gap: t.space.lg }}>
        <Text variant="heading">{tx('rs_gifts')}</Text>
        <Text variant="caption" muted>{tx('rs_gifts_b')}</Text>
        <Field label={tx('rs_upi')} value={f.upi_vpa ?? ''} onChangeText={set('upi_vpa')} placeholder="riya@okaxis" autoCapitalize="none" autoCorrect={false} error={errors.upi} />
        <Field label={tx('rs_payee')} value={f.upi_payee_name ?? ''} onChangeText={set('upi_payee_name')} placeholder="Riya Sharma" />
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}><Text variant="label">{tx('rs_progress')}</Text><Text variant="caption" muted>{tx('rs_progress_b')}</Text></View>
          <Switch thumbColor="#FFFFFF" value={!!f.show_progress} onValueChange={set('show_progress')} trackColor={{ true: t.colors.accent, false: t.colors.border }} accessibilityLabel={tx('rs_progress')} />
        </Row>
      </Card>

      <Card style={{ gap: t.space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">{tx('rs_theme')}</Text>
          {!premium ? <Button title={tx('rs_unlock')} kind="ghost" full={false} onPress={() => router.push('/premium')} /> : null}
        </Row>
        <Row wrap gap={t.space.sm}>
          {registryThemeNames.map((th) => (
            <Chip key={th} label={rtLabel(th)} color={registryThemeSwatch(th)} selected={f.theme === th}
              onPress={() => (premium || th === 'rose' ? set('theme')(th as RegistryTheme) : router.push('/premium'))} />
          ))}
        </Row>
        {id ? (
          <Field label={tx('rs_link')} value={f.slug ?? ''} onChangeText={set('slug')} editable={premium} autoCapitalize="none"
            hint={`${config.webUrl.replace('https://', '')}/r/${f.slug ?? ''}${premium ? '' : tx('rs_link_prem')}`} />
        ) : <Text variant="caption" muted>{tx('rs_link_auto')}</Text>}
      </Card>

      <Button title={id ? tx('rs_save') : tx('rs_make')} kind="accent" loading={create.isPending || update.isPending} onPress={submit} />
    </Screen>
  );
}
