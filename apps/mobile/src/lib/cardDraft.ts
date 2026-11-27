/* Local, per-device context for creating / editing a Shagun Card:
   - the gift being "carded" (pledge reference + token) so the wizard works after a reload or after the payment browser closes
   - the edit key returned at checkout, which lets the buyer switch designs later without paying again. */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CardContext = {
  reference: string; token: string; slug?: string; partnerOne: string; partnerTwo: string; weddingDate?: string | null;
  guestName?: string; message?: string;
  premium?: boolean;
};
const CTX = 'pk.cardctx';
const keyOf = (id: string) => `pk.cardkey.${id}`;

export async function saveCardContext(c: CardContext) { try { await AsyncStorage.setItem(CTX, JSON.stringify(c)); } catch { /* non-fatal */ } }
export async function loadCardContext(): Promise<CardContext | null> {
  try { const v = await AsyncStorage.getItem(CTX); return v ? (JSON.parse(v) as CardContext) : null; } catch { return null; }
}
export async function saveEditKey(id: string, key: string) { try { await AsyncStorage.setItem(keyOf(id), key); } catch { /* non-fatal */ } }
export async function loadEditKey(id: string): Promise<string | null> { try { return await AsyncStorage.getItem(keyOf(id)); } catch { return null; } }
