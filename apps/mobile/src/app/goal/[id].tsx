import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';

import { Banner, Button, Card, Chip, Field, Row, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import type { Category } from '@/lib/api';
import { CATEGORIES } from '@/lib/categories';
import { errorMessage, useDeleteGoal, useRegistry, useSaveGoal } from '@/lib/queries';

export default function GoalEditor() {
  const t = useTheme();
  const { id, registry } = useLocalSearchParams<{ id: string; registry: string }>();
  const isNew = id === 'new';
  const reg = useRegistry(registry);
  const goal = reg.data?.goals.find((g) => g.id === id);
  const save = useSaveGoal(registry);
  const del = useDeleteGoal();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('honeymoon');
  const [target, setTarget] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [paused, setPaused] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (goal) {
      setTitle(goal.title); setDescription(goal.description); setCategory(goal.category);
      setTarget(String(goal.target_paise / 100)); setPrivate(goal.visibility === 'private'); setPaused(goal.status === 'paused');
    }
  }, [goal]);

  const rupees = Number(target.replace(/[,₹\s]/g, ''));
  const targetErr = target && (!Number.isInteger(rupees) || rupees < 100 || rupees > 100000000) ? 'Enter a whole amount between ₹100 and ₹10 crore' : null;

  const submit = () => {
    setErr(null);
    if (!title.trim()) { setErr('Give your goal a name.'); return; }
    if (!target || targetErr) { setErr('Set a target amount.'); return; }
    save.mutate({
      id: isNew ? undefined : id,
      body: { title: title.trim(), description: description.trim(), category, target_rupees: rupees, visibility: isPrivate ? 'private' : 'public',
        ...(isNew ? {} : { status: paused ? 'paused' : goal?.status === 'paused' ? 'active' : goal?.status }) },
    }, { onSuccess: () => router.back(), onError: (e) => setErr(errorMessage(e)) });
  };

  const remove = () => {
    const run = () => del.mutate(id, { onSuccess: () => router.back(), onError: (e) => setErr(errorMessage(e)) });
    if (Platform.OS === 'web') { if (window.confirm('Remove this goal?')) run(); return; }
    Alert.alert('Remove goal?', goal?.contributions_count ? 'It has gifts, so it will be hidden (your gift history is kept).' : 'This cannot be undone.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: run }]);
  };

  return (
    <Screen>
      <Text variant="title">{isNew ? 'New goal' : 'Edit goal'}</Text>
      {err ? <Banner tone="negative" title={err} /> : null}
      <Card style={{ gap: t.space.lg }}>
        <Field label="What's the dream?" value={title} onChangeText={setTitle} placeholder="Honeymoon in Bali" maxLength={80} />
        <View style={{ gap: 6 }}>
          <Text variant="label">Category</Text>
          <Row wrap gap={t.space.sm}>{CATEGORIES.map((c) => <Chip key={c.key} label={c.label} selected={category === c.key} onPress={() => setCategory(c.key)} />)}</Row>
        </View>
        <Field label="Target amount (₹)" value={target} onChangeText={setTarget} keyboardType="number-pad" placeholder="1,50,000" error={targetErr} />
        <Field label="Tell guests about it (optional)" value={description} onChangeText={setDescription} multiline maxLength={600}
          placeholder="7 nights in Ubud and Nusa Penida — flights, villa and a sunrise trek." />
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}><Text variant="label">Private goal</Text><Text variant="caption" muted>Only you can see it.</Text></View>
          <Switch thumbColor="#FFFFFF" value={isPrivate} onValueChange={setPrivate} trackColor={{ true: t.colors.accent, false: t.colors.border }} accessibilityLabel="Private goal" />
        </Row>
        {!isNew ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}><Text variant="label">Pause gifts</Text><Text variant="caption" muted>Guests can see it but can't contribute.</Text></View>
            <Switch thumbColor="#FFFFFF" value={paused} onValueChange={setPaused} trackColor={{ true: t.colors.accent, false: t.colors.border }} accessibilityLabel="Pause gifts" />
          </Row>
        ) : null}
      </Card>
      <Button title={isNew ? 'Add goal' : 'Save'} kind="accent" loading={save.isPending} onPress={submit} />
      {!isNew ? <Button title="Remove goal" kind="danger" onPress={remove} loading={del.isPending} /> : null}
    </Screen>
  );
}
