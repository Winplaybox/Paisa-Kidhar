export const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromISODate = (s?: string | null) => {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
export const prettyDate = (s?: string | null) =>
  fromISODate(s)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) ?? '';
