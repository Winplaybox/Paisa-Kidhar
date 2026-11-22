/* Leaked-password check via Have I Been Pwned "range" API (k-anonymity: only the first 5 hex chars of the SHA-1 leave the device).
   Pure-JS SHA-1 so it ships by OTA (no native module). Fails open: network trouble never blocks sign-up. */

function sha1Hex(input: string): string {
  const bytes: number[] = [];
  for (const ch of unescape(encodeURIComponent(input))) bytes.push(ch.charCodeAt(0));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
  for (const v of [hi, lo]) bytes.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Array<number>(80);
  const rol = (n: number, s: number) => (n << s) | (n >>> (32 - s));
  for (let i = 0; i < bytes.length; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
    for (let j = 16; j < 80; j++) w[j] = rol(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let j = 0; j < 80; j++) {
      const [f, k] = j < 20 ? [(b & c) | (~b & d), 0x5a827999] : j < 40 ? [b ^ c ^ d, 0x6ed9eba1] : j < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc] : [b ^ c ^ d, 0xca62c1d6];
      const tmp = (rol(a, 5) + f + e + k + w[j]) | 0;
      e = d; d = c; c = rol(b, 30); b = a; a = tmp;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('').toUpperCase();
}

/** true only when the password is known to appear in a breach; false on any doubt or error. */
export async function isLeakedPassword(password: string): Promise<boolean> {
  try {
    const hash = sha1Hex(password);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { headers: { 'Add-Padding': 'true' }, signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const suffix = hash.slice(5);
    return (await res.text()).split('\n').some((l) => {
      const [s, n] = l.trim().split(':');
      return s === suffix && Number(n) > 0;
    });
  } catch { return false; }
}
