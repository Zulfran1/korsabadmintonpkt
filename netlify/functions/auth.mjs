/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/auth — login
   Body: { username, password }
   Response: { user: { username, role, meja } }
   Cookie: korsa_session=<token>
   ═══════════════════════════════════════════════════════════════════════════ */

import bcrypt from 'bcryptjs';
import {
  ok, badRequest, unauthorized, tooMany, serverError,
  readJSON, withCookie, requireMethod,
} from './_lib/respond.mjs';
import {
  getLoginAttempts, setLoginAttempts, clearLoginAttempts,
} from './_lib/blob.mjs';
import { createSession, COOKIE_OPTS, cookieMaxAge } from './_lib/session.mjs';
import { COOKIE_NAME } from './_lib/auth.mjs';

/* ── Ambil daftar akun dari env var ─────────────────────────────────────── */
export function getAccounts() {
  const accounts = [];

  /* Admin */
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH) {
    accounts.push({
      username: process.env.ADMIN_USERNAME,
      hash: process.env.ADMIN_PASSWORD_HASH,
      role: 'admin',
      meja: null,
    });
  }

  /* Operator meja 1–4 */
  for (let i = 1; i <= 4; i++) {
    const u = process.env[`OP${i}_USERNAME`];
    const h = process.env[`OP${i}_PASSWORD_HASH`];
    const m = Number(process.env[`OP${i}_MEJA`] || i);
    if (u && h) {
      accounts.push({ username: u, hash: h, role: 'operator', meja: m });
    }
  }

  return accounts;
}

/* ── Ambil IP client ────────────────────────────────────────────────────── */
function getIP(req) {
  return (
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */

export default async (req) => {
  const methodErr = requireMethod(req, 'POST');
  if (methodErr) return methodErr;

  const body = await readJSON(req);
  if (!body) return badRequest('Body JSON tidak valid');

  const { username, password } = body;
  if (!username || !password) {
    return badRequest('Username dan password wajib diisi');
  }

  const ip = getIP(req);
  const maxAttempts = Number(process.env.LOGIN_MAX_ATTEMPTS) || 5;
  const windowSeconds = Number(process.env.LOGIN_WINDOW_SECONDS) || 60;

  /* ── Cek rate limit ─────────────────────────────────────────────────── */
  const attempts = await getLoginAttempts(ip);
  const now = Date.now();

  if (attempts.count >= maxAttempts) {
    if (now - attempts.firstAt < windowSeconds * 1000) {
      return tooMany(`Terlalu banyak percobaan. Coba lagi dalam ${windowSeconds} detik.`);
    }
    /* Window sudah lewat, reset */
    await clearLoginAttempts(ip);
  }

  /* ── Cari akun ──────────────────────────────────────────────────────── */
  const accounts = getAccounts();
  const account = accounts.find(a => a.username === String(username).trim());

  /* Selalu jalankan bcrypt.compare — biar timing attack tidak bisa
     membedakan "username salah" vs "password salah" */
  const dummyHash = '$2a$12$0000000000000000000000000000000000000000000000000000';
  const hash = account ? account.hash : dummyHash;
  const match = await bcrypt.compare(String(password), hash);

  if (!account || !match) {
    /* Increment attempt counter */
    const newCount = (now - attempts.firstAt < windowSeconds * 1000)
      ? attempts.count + 1
      : 1;
    await setLoginAttempts(ip, {
      count: newCount,
      firstAt: (newCount === 1) ? now : attempts.firstAt,
    });
    return unauthorized('Username atau password salah');
  }

  /* ── Login sukses ───────────────────────────────────────────────────── */
  await clearLoginAttempts(ip);

  const { token } = await createSession({
    username: account.username,
    role: account.role,
    meja: account.meja,
  });

  const res = ok({
    user: {
      username: account.username,
      role: account.role,
      meja: account.meja,
    },
  });

  withCookie(res, COOKIE_NAME, token, {
    ...COOKIE_OPTS,
    maxAge: cookieMaxAge(),
  });

  return res;
};

/* ── Config ──────────────────────────────────────────────────────────────── */
export const config = {
  path: '/api/auth',
};
