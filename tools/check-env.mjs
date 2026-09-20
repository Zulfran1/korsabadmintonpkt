import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(import.meta.dirname, '..', '.env');
if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

const errors = [];
const usernames = [];
const tables = [];

function validateAccount(label, usernameKey, hashKey) {
  const username = process.env[usernameKey]?.trim();
  const hash = process.env[hashKey]?.trim();
  if (!username) errors.push(`${label}: ${usernameKey} belum diisi`);
  if (!hash) {
    errors.push(`${label}: ${hashKey} belum diisi`);
  } else {
    const match = hash.match(/^\$2[aby]\$(\d{2})\$/);
    if (!match || hash.includes('GANTI_')) errors.push(`${label}: ${hashKey} bukan hash bcrypt valid`);
    else if (Number(match[1]) < 10) errors.push(`${label}: cost bcrypt minimal 10`);
  }
  if (username) usernames.push(username.toLowerCase());
}

validateAccount('Admin', 'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH');
for (let i = 1; i <= 4; i++) {
  validateAccount(`Operator ${i}`, `OP${i}_USERNAME`, `OP${i}_PASSWORD_HASH`);
  const table = Number(process.env[`OP${i}_MEJA`] || i);
  if (!Number.isInteger(table) || table < 1 || table > 4) errors.push(`OP${i}_MEJA harus 1–4`);
  tables.push(table);
}

if (new Set(usernames).size !== usernames.length) errors.push('Semua username harus unik');
if (new Set(tables).size !== 4) errors.push('Empat operator harus mencakup lapangan 1, 2, 3, dan 4');

const ttl = Number(process.env.SESSION_TTL_HOURS || 12);
const maxAttempts = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const loginWindow = Number(process.env.LOGIN_WINDOW_SECONDS || 60);
if (!Number.isFinite(ttl) || ttl < 1 || ttl > 72) errors.push('SESSION_TTL_HOURS harus 1–72');
if (!Number.isInteger(maxAttempts) || maxAttempts < 3 || maxAttempts > 20) errors.push('LOGIN_MAX_ATTEMPTS harus 3–20');
if (!Number.isInteger(loginWindow) || loginWindow < 10 || loginWindow > 3600) errors.push('LOGIN_WINDOW_SECONDS harus 10–3600');

if (errors.length) {
  console.error('Konfigurasi deploy belum valid:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Environment deploy valid: admin + 4 operator, hash, meja, session, dan rate limit siap.');
