// The ONE typed API client. Attaches the Supabase access token; normalises errors.
import { config } from './config';
import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

type Opts = { method?: string; body?: unknown; auth?: boolean; headers?: Record<string, string>; raw?: boolean };

async function request<T>(path: string, { method = 'GET', body, auth = true, headers = {}, raw }: Opts = {}): Promise<T> {
  const h: Record<string, string> = { accept: 'application/json', ...headers };
  if (body !== undefined) h['content-type'] = 'application/json';
  if (auth) {
    const { data } = await supabase.auth.getSession();
    if (data.session) h.authorization = `Bearer ${data.session.access_token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'offline', "You're offline or the server is waking up. Please try again.");
  }
  if (raw) return res as unknown as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = json?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'error', e.message ?? 'Something went wrong.', e.details);
  }
  return json as T;
}

// ---------- types (mirror apps/api) ----------
export type Profile = { user_id: string; username: string; email: string | null; display_name: string; is_admin: boolean; deletion_requested_at: string | null };
export type RegistryTheme = 'rose' | 'plum' | 'marigold' | 'emerald' | 'ink';
export type Registry = {
  id: string; slug: string; partner_one: string; partner_two: string; wedding_date: string | null; city: string | null; story: string;
  upi_vpa: string | null; upi_payee_name: string | null; status: 'draft' | 'published' | 'paused' | 'archived'; plan: 'free' | 'premium';
  theme: RegistryTheme; show_progress: boolean; moderation: 'ok' | 'hidden'; public_path: string;
};
export type Category = string;
export type CategoryInfo = { key: string; label: string; icon: string };
export type Goal = {
  id: string; registry_id: string; title: string; description: string; category: Category; custom_category?: string | null; target_paise: number; position: number;
  status: 'active' | 'paused' | 'archived' | 'completed'; visibility: 'public' | 'private'; target_date: string | null;
  raised_paise: number; contributions_count: number; pending_count: number;
};
export type RegistryDetail = Registry & { goals: Goal[]; goal_limit: number };
export type ContributionStatus = 'pledged' | 'guest_marked_paid' | 'confirmed' | 'rejected' | 'expired';
export type Contribution = {
  id: string; reference: string; goal_id: string; goal_title: string; amount_paise: number; guest_name: string | null;
  guest_message: string | null; is_anonymous: boolean; status: ContributionStatus; created_at: string; marked_paid_at: string | null; decided_at: string | null;
  card?: boolean;
};
export type Insights = {
  range: { from: string; to: string };
  kpis: { raised_paise: number; confirmed_count: number; pending_count: number; pending_paise: number; avg_paise: number; active_goals: number; completed_goals: number; overall_progress: number };
  daily: { day: string; paise: number }[];
  by_goal: { id: string; title: string; target_paise: number; raised_paise: number; status: string; progress: number }[];
  distribution: { bucket: string; count: number }[];
  status_mix: { status: ContributionStatus; n: number }[];
  monthly: { month: string; paise: number }[];
};
export type PublicRegistry = {
  slug: string; partner_one: string; partner_two: string; wedding_date: string | null; city: string | null; story: string; theme: RegistryTheme;
  show_progress: boolean; premium: boolean; suggested_amounts_paise: number[];
  goals: { id: string; title: string; description: string; category: Category; custom_category?: string | null; target_paise: number; status: string; raised_paise?: number; contributions_count?: number }[];
  wishes: { name: string | null; message: string; at: string; card?: boolean }[];
};
export type Pledge = { reference: string; token: string; status: ContributionStatus; amount_paise: number; goal_title: string; payee_name: string; upi_vpa: string; upi_link: string };
export type Plans = { payments_enabled: boolean; plans: { code: string; name: string; price_paise: number; billing: string; features: string[] }[];
  shagun_card?: { enabled: boolean; price_paise: number; designs: CardDesign[] } };
export type CardDesign = 'marigold' | 'rose' | 'royal' | 'mehendi';
export type ShagunCard = { id: string; status: string; design?: CardDesign; from?: string | null; message?: string | null;
  partner_one?: string; partner_two?: string; slug?: string; theme?: RegistryTheme; wedding_date?: string | null; city?: string | null };
export type AdminMetrics = { totals: Record<string, number>; weekly_signups: { week: string; n: number }[]; contribution_states: { status: string; n: number }[] };

export type RegistryInput = Partial<Pick<Registry, 'partner_one' | 'partner_two' | 'wedding_date' | 'city' | 'story' | 'upi_vpa' | 'upi_payee_name' | 'theme' | 'slug' | 'show_progress'>>;
export type GoalInput = { title: string; description?: string; category?: Category; custom_category?: string | null; target_rupees: number; target_date?: string | null; visibility?: 'public' | 'private' };

const q = (params: Record<string, string | undefined>) => {
  const s = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
  return s ? `?${s}` : '';
};

export const api = {
  login: (identifier: string, password: string) =>
    request<{ access_token: string; refresh_token: string }>('/v1/auth/login', { method: 'POST', body: { identifier, password }, auth: false }),
  usernameAvailable: (u: string) => request<{ available: boolean; reason?: string }>(`/v1/auth/username-available${q({ u })}`, { auth: false }),
  me: () => request<Profile>('/v1/me'),
  updateMe: (body: Partial<Pick<Profile, 'username' | 'display_name'>>) => request<Profile>('/v1/me', { method: 'PATCH', body }),
  requestDeletion: () => request<{ ok: boolean; message: string }>('/v1/me/deletion-request', { method: 'POST' }),

  registries: () => request<{ items: Registry[] }>('/v1/registries'),
  createRegistry: (body: RegistryInput) => request<Registry>('/v1/registries', { method: 'POST', body }),
  registry: (id: string) => request<RegistryDetail>(`/v1/registries/${id}`),
  updateRegistry: (id: string, body: RegistryInput) => request<Registry>(`/v1/registries/${id}`, { method: 'PATCH', body }),
  publish: (id: string) => request<Registry>(`/v1/registries/${id}/publish`, { method: 'POST' }),
  pause: (id: string) => request<Registry>(`/v1/registries/${id}/pause`, { method: 'POST' }),

  createGoal: (registryId: string, body: GoalInput) => request<Goal>(`/v1/registries/${registryId}/goals`, { method: 'POST', body }),
  updateGoal: (goalId: string, body: Partial<GoalInput> & { status?: Goal['status'] }) => request<Goal>(`/v1/goals/${goalId}`, { method: 'PATCH', body }),
  deleteGoal: (goalId: string) => request<{ ok: boolean }>(`/v1/goals/${goalId}`, { method: 'DELETE' }),
  reorderGoals: (registryId: string, goal_ids: string[]) => request(`/v1/registries/${registryId}/goals/order`, { method: 'PUT', body: { goal_ids } }),

  contributions: (registryId: string, f: { status?: ContributionStatus; goal_id?: string } = {}) =>
    request<{ items: Contribution[]; total: number }>(`/v1/registries/${registryId}/contributions${q(f)}`),
  decide: (id: string, decision: 'confirmed' | 'rejected') => request<Contribution>(`/v1/contributions/${id}/decision`, { method: 'POST', body: { decision } }),
  exportCsv: (registryId: string) => request<Response>(`/v1/registries/${registryId}/contributions.csv`, { raw: true }),
  insights: (registryId: string, f: { from?: string; to?: string; goal_id?: string } = {}) => request<Insights>(`/v1/registries/${registryId}/insights${q(f)}`),

  publicRegistry: (slug: string) => request<PublicRegistry>(`/v1/public/registries/${slug}`, { auth: false }),
  createPledge: (slug: string, body: { goal_id: string; amount_paise: number; guest_name?: string; guest_message?: string; is_anonymous?: boolean }, idempotencyKey: string) =>
    request<Pledge>(`/v1/public/registries/${slug}/pledges`, { method: 'POST', body, auth: false, headers: { 'idempotency-key': idempotencyKey } }),
  markPaid: (reference: string, token: string) =>
    request<{ status: ContributionStatus }>(`/v1/public/pledges/${reference}/mark-paid`, { method: 'POST', body: { token }, auth: false }),

  pledgeStatus: (reference: string, token: string) =>
    request<{ status: ContributionStatus }>(`/v1/public/pledges/${reference}?token=${encodeURIComponent(token)}`, { auth: false }),

  categories: () => request<{ categories: CategoryInfo[] }>('/v1/public/categories', { auth: false }),
  plans: () => request<Plans>('/v1/billing/plans', { auth: false }),
  cardCheckout: (reference: string, token: string, email: string, design: CardDesign) =>
    request<{ card_id: string; checkout_url: string }>(`/v1/public/pledges/${reference}/card-checkout`, { method: 'POST', body: { token, email, design }, auth: false }),
  card: (id: string) => request<ShagunCard>(`/v1/public/cards/${id}`, { auth: false }),
  checkout: (registry_id: string) => request<{ order_id: string; checkout_url: string }>('/v1/billing/checkout', { method: 'POST', body: { registry_id } }),
  order: (id: string) => request<{ status: string; registry_id: string }>(`/v1/billing/orders/${id}`),

  adminMetrics: () => request<AdminMetrics>('/v1/admin/metrics'),
  adminRegistries: (qs: string) => request<{ items: (Registry & { owner_username: string })[] }>(`/v1/admin/registries${q({ q: qs })}`),
  moderate: (id: string, action: 'hide' | 'unhide') => request(`/v1/admin/registries/${id}/moderation`, { method: 'POST', body: { action } }),

  track: (name: string, props: Record<string, string | number | boolean> = {}) =>
    request('/v1/events', { method: 'POST', body: { name, props } }).catch(() => undefined),
};
