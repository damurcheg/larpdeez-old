#!/usr/bin/env node
// Set (or reset) the platform password directly in a D1 database.
// Produces a "pbkdf2:<iterations>:<saltHex>:<hashHex>" value identical to
// what Pages Functions verify (functions/lib/crypto.js).
//
// Usage:
//   node scripts/set-password.mjs <password>
// Then apply the printed SQL, e.g.:
//   npx wrangler d1 execute edu-platform --remote --command "<SQL>"
//
// The password is taken from argv — prefer running on a private machine,
// or pass it via env to avoid shell history:  PW='secret' node scripts/set-password.mjs "$PW"

import process from 'node:process';

const PBKDF2_ITERATIONS = 150000; // must match functions/lib/crypto.js

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/set-password.mjs <password>');
  process.exit(1);
}
if (String(password).length < 6) {
  console.error('Password must be at least 6 characters.');
  process.exit(1);
}

const enc = new TextEncoder();
const saltBytes = crypto.getRandomValues(new Uint8Array(16));
const saltHex = [...saltBytes].map((b) => b.toString(16).padStart(2, '0')).join('');

const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
  key,
  32 * 8
);
const hashHex = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
const stored = `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}

const sql =
  `INSERT INTO settings (key, value) VALUES ('passwordHash', '${stored}') ` +
  `ON CONFLICT(key) DO UPDATE SET value = excluded.value; ` +
  `INSERT INTO settings (key, value) VALUES ('password_source', 'user') ` +
  `ON CONFLICT(key) DO UPDATE SET value = excluded.value;`;

console.log('Apply this command to your REMOTE D1 (production):\n');
console.log(`npx wrangler d1 execute edu-platform --remote --command "${sql}"`);
console.log('\nOr locally (wrangler pages dev):\n');
console.log(`npx wrangler d1 execute edu-platform --local --command "${sql}"`);
