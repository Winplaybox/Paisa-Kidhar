import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';

import { Banner, Button, Card, Chip, Field, Row, Screen, Text } from '@/design-system/components';
import { DateField } from '@/design-system/DateField';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import type { Category } from '@/lib/api';
import { categoryLabel, useCategories } from '@/lib/categories';
import { formatINR } from '@/lib/money';
import { errorMessage, useDeleteGoal, useRegistry, useSaveGoal } from '@/lib/queries';

export default function GoalEditor() {
  const t = useTheme();
  const { t: tx } = useI18n();
  const { id, registry } = useLocalSearchParams<{ id: string; registry: string }>();
  const isNew = id === 'new';
  const reg = useRegistry(registry);
  const goal = reg.data?.goals.find((g) => g.id === id);
  const save = useSaveGoal(registry);
  const del = useDeleteGoal();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const categories = useCategories();
  const [category, setCategory] = useState<Category>('honeymoon');
  const [custom, setCustom] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [paused, setPaused] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (goal) {
      setTitle(goal.title); setDescription(goal.description); setCategory(goal.category); setCustom(goal.custom_category ?? '');
      setTarget(String(goal.target_paise / 100)); setTargetDate(goal.target_date ?? ''); setPrivate(goal.visibility === 'private'); setPaused(goal.status === 'paused');
    }
  }, [goal]);

  const rupees = Number(target.replace(/[,₹\s]/g, ''));
  const targetErr = target && (!Number.isInteger(rupees) || rupees < 100 || rupees > 100000000) ? tx('gl_target_err') : null;

  const submit = () => {
    setErr(null);
    if (!title.trim()) { setErr(tx('gl_err_name')); return; }
    if (!target || targetErr) { setErr(tx('gl_err_target')); return; }
    if (category === 'other' && custom.trim() && custom.trim().length < 2) { setErr(tx('gl_err_cat')); return; }
    save.mutate({
      id: isNew ? undefined : id,
      body: { title: title.trim(), description: description.trim(), category, custom_category: category === 'other' ? custom.trim() || null : null, target_rupees: rupees, target_date: targetDate || null, visibility: isPrivate ? 'private' : 'public',
        ...(isNew ? {} : { status: paused ? 'paused' : goal?.status === 'paused' ? 'active' : goal?.status }) },
    }, { onSuccess: () => router.back(), onError: (e) => setErr(errorMessage(e)) });
  };

  const remove = () => {
    const run = () => del.mutate(id, { onSuccess: () => router.back(), onError: (e) => setErr(errorMessage(e)) });
    if (Platform.OS === 'web') { if (window.confirm(tx('gl_remove_q'))) run(); return; }
    Alert.alert(tx('gl_remove_q'), goal?.contributions_count ? tx('gl_remove_hidden') : tx('gl_remove_final'),
      [{ text: tx('common_cancel'), style: 'cancel' }, { text: tx('common_remove'), style: 'destructive', onPress: run }]);
  };

  return (
    <Screen>
      <Text variant="title">{isNew ? tx('gl_new') : tx('gl_edit')}</Text>
      {err ? <Banner tone="negative" title={err} /> : null}
      <Card style={{ gap: t.space.lg }}>
        <Field label={tx('gl_dream')} value={title} onChangeText={setTitle} placeholder={tx('gl_dream_ph')} maxLength={80} />
        <View style={{ gap: 6 }}>
          <Text variant="label">{tx('gl_category')}</Text>
          <Row wrap gap={t.space.sm}>{categories.map((c) => <Chip key={c.key} label={categoryLabel(categories, c.key)} selected={category === c.key} onPress={() => setCategory(c.key)} />)}</Row>
          {category === 'other' ? (
            <Field label={tx('gl_own_cat')} value={custom} onChangeText={setCustom} maxLength={40} placeholder={tx('gl_own_cat_ph')} />
          ) : null}
        </View>
        <Field label={tx('gl_target')} value={target} onChangeText={(v) => setTarget(v.replace(/[^\d]/g, ''))} keyboardType="number-pad" inputMode="numeric"
          placeholder="150000" error={targetErr} hint={rupees >= 100 && !targetErr ? formatINR(rupees * 100) : undefined} maxLength={9} />
        <DateField label={tx('gl_by')} value={targetDate} onChange={setTargetDate} minimumDate={new Date()} hint={tx('gl_by_hint')} />
        <Field label={tx('gl_about')} value={description} onChangeText={setDescription} multiline maxLength={600}
          placeholder={tx('gl_about_ph')} />
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}><Text variant="label">{tx('ge_private')}</Text><Text variant="caption" muted>{tx('gl_private_b')}</Text></View>
          <Switch thumbColor="#FFFFFF" value={isPrivate} onValueChange={setPrivate} trackColor={{ true: t.colors.accent, false: t.colors.border }} accessibilityLabel={tx('ge_private')} />
        </Row>
        {!isNew ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}><Text variant="label">{tx('ge_pause')}</Text><Text variant="caption" muted>{tx('gl_pause_b')}</Text></View>
            <Switch thumbColor="#FFFFFF" value={paused} onValueChange={setPaused} trackColor={{ true: t.colors.accent, false: t.colors.border }} accessibilityLabel={tx('ge_pause')} />
          </Row>
        ) : null}
      </Card>
      <Button title={isNew ? tx('gl_add') : tx('common_save')} kind="accent" loading={save.isPending} onPress={submit} />
      {!isNew ? <Button title={tx('gl_remove')} kind="danger" onPress={remove} loading={del.isPending} /> : null}
    </Screen>
  );
}
