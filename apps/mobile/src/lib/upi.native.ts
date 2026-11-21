// Launch the UPI chooser and read the result the UPI app hands back (Android returns Status=SUCCESS|FAILURE|SUBMITTED).
// The result is a strong hint, not proof (it is client-side) — the couple still confirms receipt on their side.
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

export type UpiOutcome = 'success' | 'failure' | 'pending' | 'unknown' | 'no_app';

export function parseUpiResponse(raw: string): UpiOutcome {
  const m = /status=([a-z_]+)/i.exec(raw);
  const s = (m?.[1] ?? '').toLowerCase();
  if (s === 'success') return 'success';
  if (s === 'failure' || s === 'failed') return 'failure';
  if (s === 'submitted' || s === 'pending') return 'pending';
  return 'unknown';
}

export async function payWithUpi(link: string): Promise<UpiOutcome> {
  if (Platform.OS !== 'android') {
    try { await Linking.openURL(link); return 'unknown'; } catch { return 'no_app'; }
  }
  try {
    const r = await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: link });
    const raw = `${r.data ?? ''}&${JSON.stringify(r.extra ?? {})}`.replace(/[{}"]/g, '&').replace(/:/g, '=').replace(/,/g, '&');
    if (r.resultCode === IntentLauncher.ResultCode.Canceled) return parseUpiResponse(raw) === 'unknown' ? 'failure' : parseUpiResponse(raw);
    return parseUpiResponse(raw);
  } catch {
    return 'no_app';
  }
}
