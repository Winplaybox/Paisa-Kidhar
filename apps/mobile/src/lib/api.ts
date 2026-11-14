/** Client for the Python (FastAPI) backend. Every call carries the Supabase access token. */
import { env } from './env';
import type { ParsedTxn } from './parser';
import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError('Login expire ho gaya, dobara sign in karo', 401);
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 60_000): Promise<T> {
  if (!env.apiUrl) throw new ApiError('Backend URL set nahi hai (EXPO_PUBLIC_API_URL)');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.apiUrl}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(await authHeader()), ...(init.headers ?? {}) },
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError((body as { detail?: string }).detail || `Server error ${res.status}`, res.status);
    return body as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') throw new ApiError('Server slow hai — 1 minute baad try karo');
    throw new ApiError('Network issue — internet check karo');
  } finally {
    clearTimeout(timer);
  }
}

/** Free-tier servers sleep; ping on launch so the first real call is fast. */
export function warmUp(): void {
  if (!env.apiUrl) return;
  fetch(`${env.apiUrl}/health`).catch(() => undefined);
}

type ApiTxn = { amount: number; merchant: string; category: string; occurred_at: string; raw: string };

export async function parseStatementFile(file: { uri: string; name: string; mimeType?: string | null }): Promise<ParsedTxn[]> {
  const form = new FormData();
  // React Native FormData file shape
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as unknown as Blob);
  const out = await request<{ items: ApiTxn[] }>('/v1/statements/parse', { method: 'POST', body: form }, 120_000);
  return out.items.map((i) => ({
    ok: true, type: 'debit', raw: i.raw, amount: i.amount, merchant: i.merchant,
    category: i.category as ParsedTxn['category'], occurredAt: new Date(i.occurred_at).getTime(),
  }));
}

export type Insight = { id: string; kind: 'leak' | 'subscription' | 'spike' | 'trend' | 'tip' | 'win'; title: string; body: string; amount?: number | null; emoji: string };
export type InsightsResponse = {
  month: string;
  insights: Insight[];
  subscriptions: { merchant: string; amount: number; months: number }[];
  projected_month_total: number | null;
};

export function fetchInsights(month: string): Promise<InsightsResponse> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  return request<InsightsResponse>(`/v1/insights?month=${encodeURIComponent(month)}&tz=${encodeURIComponent(tz)}`);
}
