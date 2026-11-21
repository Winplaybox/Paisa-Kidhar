import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { Banner, Button, Card, Chip, Field, Row, Screen, Text } from '@/design-system/components';
import { registryThemeNames, registryThemeSwatch } from '@/design-system/theme';
import { DateField } from '@/design-system/DateField';
import { useTheme } from '@/design-system/ThemeProvider';
import type { RegistryInput, RegistryTheme } from '@/lib/api';
import { config } from '@/lib/config';
import { errorMessage, useCreateRegistry, useRegistry, useUpdateRegistry } from '@/lib/queries';

const VPA = /^[a-zA-Z0-9.\-_]{2,128}@[a-zA-Z][a-zA-Z0-9]{1,64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function RegistrySetup() {
  const t = useTheme();
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

  const errors = {
    upi: f.upi_vpa && !VPA.test(f.upi_vpa.trim()) ? 'That doesn’t look like a UPI ID (e.g. riya@okaxis)' : null,
    date: f.wedding_date && !DATE.test(f.wedding_date) ? 'Pick a valid date' : null,
  };

  const submit = () => {
    setErr(null);
    if (!f.partner_one?.trim() || !f.partner_two?.trim()) { setErr('Add both names.'); return; }
    if (errors.upi || errors.date) { setErr('Please fix the highlighted fields.'); return; }
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
      <Text variant="title">{id ? 'Registry details' : 'Create your registry'}</Text>
      {err ? <Banner tone="negative" title={err} /> : null}
      <Card style={{ gap: t.space.lg }}>
        <Row gap={t.space.md} wrap>
          <View style={{ flex: 1, minWidth: 220 }}><Field label="Partner one" value={f.partner_one} onChangeText={set('partner_one')} placeholder="Riya" autoComplete="name" /></View>
          <View style={{ flex: 1, minWidth: 220 }}><Field label="Partner two" value={f.partner_two} onChangeText={set('partner_two')} placeholder="Arjun" /></View>
        </Row>
        <Row gap={t.space.md} wrap>
          <View style={{ flex: 1, minWidth: 220 }}><DateField label="Wedding date (optional)" value={f.wedding_date} onChange={set('wedding_date')} error={errors.date} /></View>
          <View style={{ flex: 1, minWidth: 220 }}><Field label="City (optional)" value={f.city ?? ''} onChangeText={set('city')} placeholder="Mumbai" autoComplete="postal-address-locality" /></View>
        </Row>
        <Field label="Your story (optional)" value={f.story} onChangeText={set('story')} multiline maxLength={1200}
          placeholder="We met at a chai stall in Pune… now we're dreaming of a honeymoon in Bali!" />
      </Card>

      <Card style={{ gap: t.space.lg }}>
        <Text variant="heading">Where gifts arrive</Text>
        <Text variant="caption" muted>Guests pay your UPI ID directly from their own UPI app. Paisa Kidhar never holds your money.</Text>
        <Field label="UPI ID" value={f.upi_vpa ?? ''} onChangeText={set('upi_vpa')} placeholder="riya@okaxis" autoCapitalize="none" autoCorrect={false} error={errors.upi} />
        <Field label="Name shown in the UPI app (optional)" value={f.upi_payee_name ?? ''} onChangeText={set('upi_payee_name')} placeholder="Riya Sharma" />
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}><Text variant="label">Show progress to guests</Text><Text variant="caption" muted>Guests see how much each goal has raised.</Text></View>
          <Switch thumbColor="#FFFFFF" value={!!f.show_progress} onValueChange={set('show_progress')} trackColor={{ true: t.colors.accent, false: t.colors.border }} accessibilityLabel="Show progress to guests" />
        </Row>
      </Card>

      <Card style={{ gap: t.space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">Theme & link</Text>
          {!premium ? <Button title="Unlock" kind="ghost" full={false} onPress={() => router.push('/premium')} /> : null}
        </Row>
        <Row wrap gap={t.space.sm}>
          {registryThemeNames.map((th) => (
            <Chip key={th} label={th[0].toUpperCase() + th.slice(1)} color={registryThemeSwatch(th)} selected={f.theme === th}
              onPress={() => (premium || th === 'rose' ? set('theme')(th as RegistryTheme) : router.push('/premium'))} />
          ))}
        </Row>
        {id ? (
          <Field label="Registry link" value={f.slug ?? ''} onChangeText={set('slug')} editable={premium} autoCapitalize="none"
            hint={`${config.webUrl.replace('https://', '')}/r/${f.slug ?? ''}${premium ? '' : ' · custom links are Premium'}`} />
        ) : <Text variant="caption" muted>Your link is created from your names. Premium lets you customise it.</Text>}
      </Card>

      <Button title={id ? 'Save changes' : 'Create registry'} kind="accent" loading={create.isPending || update.isPending} onPress={submit} />
    </Screen>
  );
}
