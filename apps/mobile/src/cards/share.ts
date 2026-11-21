/* Save / share a card as an image (PNG) and share its link. Web: file download. Native: system share sheet (Save to gallery, WhatsApp…). */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Linking, Platform, Share } from 'react-native';

import type { CardHandle } from '@/components/ShagunCardView';

export async function saveCardPng(handle: CardHandle | null, name: string): Promise<'downloaded' | 'shared'> {
  if (!handle) throw new Error('The card is not ready yet.');
  const b64 = await handle.exportPngBase64(1080);
  const file = `${name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase() || 'shagun-card'}.png`;
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${b64}`; a.download = file;
    document.body.appendChild(a); a.click(); a.remove();
    return 'downloaded';
  }
  const f = new File(Paths.cache, file);
  if (f.exists) f.delete();
  f.create();
  f.write(b64, { encoding: 'base64' });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(f.uri, { mimeType: 'image/png', dialogTitle: 'Shagun Card', UTI: 'public.png' });
  return 'shared';
}

export async function shareLink(message: string, url: string) {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && 'share' in navigator) { try { await navigator.share({ text: message, url }); return; } catch { /* cancelled */ } }
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
    return;
  }
  await Share.share({ message });
}

export const whatsappUrl = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;
