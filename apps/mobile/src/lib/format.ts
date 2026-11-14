const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹1,23,456 — Indian grouping, absolute value. */
export const inr = (n: number) => `₹${nf.format(Math.round(Math.abs(n)))}`;

/** Signed: −₹500 / +₹500 */
export const inrSigned = (n: number) => `${n < 0 ? '−' : '+'}${inr(n)}`;

/** Compact for chart axes: ₹1.2L, ₹45k */
export function inrCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `₹${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `₹${Math.round(n)}`;
}

export const fmtTime = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
export const fmtDay = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtMonth = (d: Date) => d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
