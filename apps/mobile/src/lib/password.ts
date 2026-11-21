// Mirrors the Supabase project's password policy (lowercase, uppercase, digit, symbol; min 8).
export const STRONG = (p: string) => p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);
