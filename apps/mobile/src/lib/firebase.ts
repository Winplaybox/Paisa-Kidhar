// Web: no Firebase (the website uses rate limits + Cloudflare-style hosting protections instead).
export async function initFirebase() {}
export async function appCheckToken(): Promise<string | null> { return null; }
export function logEvent(_name: string, _params: Record<string, string | number | boolean> = {}) {}
