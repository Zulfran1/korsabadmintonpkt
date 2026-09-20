/* ═══════════════════════════════════════════════════════════════════════════
   SESSION — bikin & hancurkan session
   ═══════════════════════════════════════════════════════════════════════════ */

import crypto from 'node:crypto';
import { saveSession, deleteSession } from './blob.mjs';

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function ttlMs() {
  const hours = Number(process.env.SESSION_TTL_HOURS) || 12;
  return hours * 60 * 60 * 1000;
}

export async function createSession({ username, role, meja }) {
  const token = generateToken();
  const expiresAt = Date.now() + ttlMs();

  await saveSession(token, {
    username, role, meja: meja || null, expiresAt,
    createdAt: Date.now(),
  });

  return { token, expiresAt };
}

export async function destroySession(token) {
  await deleteSession(token);
}

export const COOKIE_OPTS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development',
  sameSite: 'Strict',
};

export function cookieMaxAge() {
  return Math.floor(ttlMs() / 1000);
}