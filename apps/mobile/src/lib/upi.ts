import { Linking } from 'react-native';

export type UpiOutcome = 'success' | 'failure' | 'pending' | 'unknown' | 'no_app';
export async function payWithUpi(link: string): Promise<UpiOutcome> {
  try { await Linking.openURL(link); return 'unknown'; } catch { return 'no_app'; }
}
