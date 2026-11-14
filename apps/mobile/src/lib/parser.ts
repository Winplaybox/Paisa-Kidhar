/**
 * On-device parser for Indian bank SMS / UPI alerts and CSV bank statements.
 * Pure functions — mirrored by backend/app/parsing.py (keep both in sync; tests cover both).
 */
import type { CategoryKey } from './categories';

export type ParsedTxn = {
  ok: boolean;
  type: 'debit' | 'credit' | 'unknown';
  raw: string;
  amount: number;
  merchant: string;
  category: CategoryKey;
  occurredAt: number; // epoch ms
  reason?: string;
};

const KEYWORDS: Record<Exclude<CategoryKey, 'upi' | 'other'>, string[]> = {
  food: ['swiggy', 'zomato', 'starbucks', 'coffee', 'cafe', 'chai', 'third wave', 'blue tokai', 'dominos', 'domino', 'pizza', 'mcdonald', 'kfc', 'burger', 'restaurant', 'eatclub', 'box8', 'haldiram', 'chaayos', 'dunkin', 'subway', 'bakery', 'biryani', 'faasos', 'eatsure'],
  grocery: ['blinkit', 'zepto', 'instamart', 'bigbasket', 'dmart', 'jiomart', 'grofers', 'dunzo', 'milkbasket', 'country delight', 'licious', 'grocery', 'kirana', 'reliance fresh', 'more retail', 'bbnow'],
  shopping: ['amazon', 'amzn', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'croma', 'tatacliq', 'reliance digital', 'decathlon', 'ikea', 'lenskart', 'firstcry', 'snapdeal', 'zara', 'uniqlo'],
  subs: ['netflix', 'spotify', 'hotstar', 'disney', 'prime video', 'primevideo', 'youtube', 'apple.com', 'apple services', 'google play', 'googleplay', 'chatgpt', 'openai', 'anthropic', 'claude.ai', 'sonyliv', 'zee5', 'jiocinema', 'audible', 'linkedin', 'icloud', 'canva', 'notion', 'adobe'],
  travel: ['uber', 'ola', 'rapido', 'irctc', 'metro', 'petrol', 'hpcl', 'iocl', 'bpcl', 'indian oil', 'shell', 'indigo', 'vistara', 'air india', 'akasa', 'makemytrip', 'goibibo', 'fastag', 'redbus', 'cleartrip', 'yulu', 'namma yatri', 'blusmart', 'parking', 'fuel'],
  bills: ['electricity', 'bescom', 'msedcl', 'mseb', 'adani electricity', 'tata power', 'mahanagar gas', 'igl', 'broadband', 'recharge', 'airtel', 'jio', 'vodafone', 'act fibernet', 'rent', 'emi', 'bajaj finance', 'insurance', 'lic', 'maintenance', 'society', 'credit card bill', 'cred'],
  health: ['pharmacy', 'apollo', '1mg', 'pharmeasy', 'netmeds', 'hospital', 'clinic', 'medplus', 'diagnostic', 'cult', 'gym', 'healthifyme'],
  fun: ['bookmyshow', 'pvr', 'inox', 'cinepolis', 'steam', 'playstation', 'dream11', 'district', 'paytm insider', 'bowling', 'smaaash'],
};

/** Word-boundary match for short keywords (avoids "ola" in "cola", "emi" in "premium"). */
function hasKeyword(text: string, kw: string): boolean {
  if (kw.length > 4) return text.includes(kw);
  const re = new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`);
  return re.test(text);
}

export function categorize(text: string, isVpa = false): CategoryKey {
  const t = String(text || '').toLowerCase();
  if (t.includes('instamart')) return 'grocery';
  for (const [k, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => hasKeyword(t, w))) return k as CategoryKey;
  }
  return isVpa ? 'upi' : 'other';
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function mkDate(y: number, m: number, d: number): Date | null {
  if (y < 100) y += 2000;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (Number.isNaN(dt.getTime()) || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

export function parseDate(s: string, now: Date = new Date()): Date | null {
  let m: RegExpMatchArray | null;
  let dt: Date | null = null;
  if ((m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) dt = mkDate(+m[1], +m[2], +m[3]);
  else if ((m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/))) dt = mkDate(+m[3], +m[2], +m[1]);
  else if ((m = s.match(/\b(\d{1,2})[-\s]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s,]*(\d{2,4})\b/i)))
    dt = mkDate(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  if (!dt) return null;
  if (dt.getTime() - now.getTime() > 86_400_000) return null; // future → misparse
  const tm = s.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i);
  if (tm) {
    let h = +tm[1];
    const ap = (tm[3] || '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h < 24 && +tm[2] < 60) dt.setHours(h, +tm[2], 0, 0);
  }
  return dt;
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function cleanMerchant(raw: string): { name: string; vpa: boolean } {
  let s = String(raw || '').trim();
  if (s.includes('@')) {
    s = s.split('@')[0]
      .replace(/^(paytmqr|bharatpe|q\d+|upi|pay|mab|bpe)[\d.]*/i, '')
      .replace(/\d{4,}/g, ' ')
      .replace(/[._-]+/g, ' ')
      .trim();
    if (!s || /^\d+$/.test(s)) return { name: 'UPI Transfer', vpa: true };
    return { name: titleCase(s).slice(0, 40), vpa: true };
  }
  s = s.replace(/\s+(ltd|pvt|private|limited|india|upi)\.?$/i, '').replace(/[*#]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!s) return { name: 'Unknown', vpa: false };
  if (s.length <= 4 && s === s.toUpperCase()) return { name: s, vpa: false };
  const name = s === s.toUpperCase() || s === s.toLowerCase() ? titleCase(s) : s;
  return { name: name.slice(0, 40), vpa: false };
}

const AMT_RE = /(?:rs\.?|inr|₹)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/gi;

function findAmount(t: string): number | null {
  for (const m of t.matchAll(AMT_RE)) {
    const before = t.slice(Math.max(0, (m.index ?? 0) - 14), m.index).toLowerCase();
    if (/bal|balance|limit|lmt|avl|available/.test(before)) continue;
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (v > 0) return v;
  }
  const m2 = t.match(/(?:debited by|debited for|spent|paid|sent)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (m2) {
    const v = parseFloat(m2[1].replace(/,/g, ''));
    if (v > 0) return v;
  }
  return null;
}

const STOP = String.raw`(?=\s+(?:on|using|via|ref|refno|for|txn|avl|from|upi|a\/c|ac|with|dt|date|thru)\b|\s*[.(;,]|$)`;
const MERCHANT_RES: RegExp[] = [
  /\bvpa\s*:?\s*([\w.-]+@[\w.-]+)/i,
  /\b([\w.-]+@(?:ybl|ok\w+|paytm|ibl|axl|upi|apl|icici|hdfcbank|sbi|axisbank|kotak|yesbank|pt\w+|wa\w+|freecharge|jupiteraxis|fbl|idfcbank|aubank|rbl|indus|hsbc|citi|barodampay|mbk|ikwik|airtel|jio|slc|dlb|abfspay|naviaxis|superyes|yapl|kmbl|axisb|rapl|amazonpay|razorpay|cnrb|pnb|unionbank|boi|kbl|federal|sib|equitas|dbs|uboi))\b/i,
  new RegExp(String.raw`\bat\s+([A-Za-z0-9][\w&.'\- ]{1,40}?)` + STOP, 'i'),
  new RegExp(String.raw`\b(?:trf to|transfer to|transferred to|credited to|paid to|sent to|payment to|to)\s+(?!your\b|a\/c\b|ac\b|account\b)([A-Za-z0-9][\w&.'@\- ]{1,40}?)` + STOP, 'i'),
  /\b(?:debited for|deducted for|autopay for|mandate for)\s+(?!rs\b|inr\b|₹)([A-Za-z][\w&.' -]{1,30}?)(?=\s+(?:autopay|on|via|ref|subscription|mandate|si)\b|\s*[.(;,]|$)/i,
  /\b(?:info|towards)\s*[:-]?\s*([\w&.'@\-/ ]{2,40}?)(?=\s*[.(;]|$)/i,
];

export function parseSms(sms: string, now: Date = new Date()): ParsedTxn | null {
  const t = String(sms).replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const debit = /\b(debited|spent|paid|sent|withdrawn|purchase|deducted|debit|dr\.?)\b/i.test(t);
  const credit = /\b(credited|received|deposited|refund(ed)?)\b/i.test(t) && !/\bdebited\b/i.test(t);
  const amount = findAmount(t);
  const base = { raw: t, amount: 0, merchant: 'Unknown', category: 'other' as CategoryKey, occurredAt: now.getTime() };
  if (!amount) return { ...base, ok: false, type: 'unknown', reason: 'Amount nahi mila' };

  let merchantRaw: string | null = null;
  for (const re of MERCHANT_RES) {
    const m = t.match(re);
    if (m) { merchantRaw = m[1]; break; }
  }
  const cm = merchantRaw ? cleanMerchant(merchantRaw) : { name: 'Unknown', vpa: false };
  const dt = parseDate(t, now);
  let occurredAt = now.getTime();
  if (dt) {
    const sameDay = dt.toDateString() === now.toDateString();
    const hasTime = /\b\d{1,2}:\d{2}/.test(t);
    occurredAt = sameDay && !hasTime ? now.getTime() : dt.getTime();
  }
  const type: ParsedTxn['type'] = credit ? 'credit' : debit ? 'debit' : 'unknown';
  return {
    ok: type === 'debit',
    type,
    raw: t,
    amount: Math.round(amount * 100) / 100,
    merchant: cm.name,
    category: merchantRaw ? categorize(`${merchantRaw} ${cm.name}`, cm.vpa) : categorize(t),
    occurredAt,
    reason: type === 'credit' ? 'Credit hai, kharcha nahi' : type === 'unknown' ? 'Debit/credit samajh nahi aaya' : undefined,
  };
}

export function splitMessages(text: string): string[] {
  const blocks = String(text || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out: string[] = [];
  for (const b of blocks) {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    const withAmt = lines.filter((l) => /(?:rs\.?|inr|₹)\s*:?\s*\d/i.test(l));
    if (lines.length > 1 && withAmt.length >= 2) out.push(...lines);
    else out.push(b);
  }
  return out;
}

export function parseSmsBatch(text: string, now: Date = new Date()): ParsedTxn[] {
  return splitMessages(text).map((m) => parseSms(m, now)).filter((x): x is ParsedTxn => !!x);
}

/* ---------------- CSV ---------------- */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const src = String(text).replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === '\t') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

export function narrationMerchant(n: string): { name: string; vpa: boolean } {
  const s = String(n || '').trim();
  if (/^(upi|imps|neft)[/-]/i.test(s)) {
    const parts = s.split(/[/-]/).map((p) => p.trim()).filter(Boolean);
    for (const p of parts.slice(1)) {
      if (/^(dr|cr|p2m|p2a|upi|imps|neft|payment|pay|collect)$/i.test(p)) continue;
      if (/^\d+$/.test(p)) continue;
      if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(p)) continue; // IFSC
      return cleanMerchant(p);
    }
  }
  const t = s
    .replace(/^(pos|ecom|ach|nach|atm|bil|onl)[\s/\-:]*/i, '')
    .replace(/\b\d*[xX*]{2,}\d+\b/g, '')
    .replace(/\b\d{3,}\b/g, '')
    .replace(/[/\-_]+/g, ' ')
    .trim();
  return cleanMerchant(t.split(/\s+/).slice(0, 3).join(' ') || 'Bank Txn');
}

export function parseCsvStatement(text: string, now: Date = new Date()): { items: ParsedTxn[]; error?: string } {
  const rows = parseCsvRows(text);
  const hi = rows.findIndex(
    (r) => r.some((c) => /date/i.test(c)) && r.some((c) => /(narration|description|particular|remark|detail|amount|withdraw|debit)/i.test(c)),
  );
  if (hi < 0) return { items: [], error: 'Header row (Date, Narration, Debit…) nahi mila' };
  const H = rows[hi].map((h) => h.toLowerCase());
  const find = (re: RegExp) => H.findIndex((h) => re.test(h));
  const di = find(/date/);
  const ni = find(/narration|description|particular|remark|detail/);
  const tyi = find(/type|cr\s*\/\s*dr|dr\s*\/\s*cr/);
  const dbi = H.findIndex((h, i) => i !== tyi && /withdraw|debit|\bdr\b/.test(h));
  const ami = find(/amount|amt/);
  if (di < 0 || (dbi < 0 && ami < 0)) return { items: [], error: 'Date ya Debit/Amount column nahi mila' };
  const num = (v?: string) => {
    const x = parseFloat(String(v ?? '').replace(/[₹,\s]/g, '').replace(/^\((.*)\)$/, '-$1'));
    return Number.isNaN(x) ? 0 : x;
  };
  const body = rows.slice(hi + 1);
  const anyNeg = dbi < 0 && body.some((r) => num(r[ami]) < 0);
  const items: ParsedTxn[] = [];
  for (const r of body) {
    let amount = 0;
    if (dbi >= 0) amount = Math.abs(num(r[dbi]));
    else {
      const v = num(r[ami]);
      if (tyi >= 0) { if (/cr/i.test(r[tyi] ?? '')) continue; amount = Math.abs(v); }
      else if (anyNeg) { if (v >= 0) continue; amount = -v; }
      else amount = v;
    }
    if (!(amount > 0)) continue;
    const dt = parseDate(r[di] ?? '', now);
    if (!dt) continue;
    const narr = ni >= 0 ? r[ni] ?? '' : '';
    const cm = narrationMerchant(narr);
    items.push({
      ok: true, type: 'debit', raw: narr, amount: Math.round(amount * 100) / 100,
      merchant: cm.name, category: categorize(`${narr} ${cm.name}`, /upi/i.test(narr)), occurredAt: dt.getTime(),
    });
  }
  return { items };
}

/** Stable key so re-importing the same SMS/statement row never duplicates. */
export function dedupeKey(t: { amount: number; merchant: string; occurredAt: number }, source: string): string {
  const d = new Date(t.occurredAt);
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const minute = source === 'sms' ? `${d.getHours()}${d.getMinutes()}` : '';
  return `${source}:${day}${minute}:${t.amount.toFixed(2)}:${t.merchant.toLowerCase().replace(/\s+/g, '')}`.slice(0, 128);
}
