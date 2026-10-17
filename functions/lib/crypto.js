// Web Crypto helpers (Cloudflare Workers runtime — no Node APIs here).

export function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomHex(nbytes) {
  const a = new Uint8Array(nbytes);
  crypto.getRandomValues(a);
  return bytesToHex(a);
}

export function uid() {
  return crypto.randomUUID();
}

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text));
  return bytesToHex(await crypto.subtle.digest('SHA-256', data));
}

// PBKDF2 password hashing: "pbkdf2:<iterations>:<saltHex>:<hashHex>"
const PBKDF2_ITERATIONS = 150000;

async function pbkdf2(password, saltHex, iterations, lenBytes) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' },
    key,
    lenBytes * 8
  );
  return bytesToHex(bits);
}

export async function hashPassword(password) {
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS, 32);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt}:${hash}`;
}

export function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  // Legacy local-server format used scrypt (unavailable in the Workers runtime) —
  // such hashes cannot be verified here; reset the password once after migration.
  if (parts.length === 4 && parts[0] === 'pbkdf2') {
    const iterations = parseInt(parts[1], 10);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;
    if (!/^[0-9a-f]*$/i.test(parts[2]) || parts[2].length % 2) return false;
    const hash = await pbkdf2(password, parts[2], iterations, 32);
    return timingSafeEqualStr(hash, parts[3]);
  }
  return false;
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(message)));
  return bytesToHex(sig);
}
