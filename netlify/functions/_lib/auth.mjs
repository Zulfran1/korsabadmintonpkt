/* ═══════════════════════════════════════════════════════════════════════════
   AUTH — verifikasi session & role
   Dipanggil di setiap endpoint yang butuh login.
   ═══════════════════════════════════════════════════════════════════════════ */

import { loadSession } from './blob.mjs';
import { getCookie } from './respond.mjs';

export const COOKIE_NAME = 'korsa_session';

/* ── Role ───────────────────────────────────────────────────────────────── */
export const ROLE = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
};

/* ── Ambil user dari request ─────────────────────────────────────────────
   Return: { username, role, meja } atau null
   ──────────────────────────────────────────────────────────────────────── */
export async function getUser(req) {
  const token = getCookie(req, COOKIE_NAME);
  if (!token) return null;

  const session = await loadSession(token);
  if (!session) return null;

  /* Cek expired */
  if (session.expiresAt && session.expiresAt < Date.now()) {
    return null;
  }

  return {
    username: session.username,
    role: session.role,
    meja: session.meja || null,
    token,
  };
}

/* ── Wajib login ─────────────────────────────────────────────────────────
   Return: { user } atau { error: Response }
   ──────────────────────────────────────────────────────────────────────── */
export async function requireLogin(req) {
  const user = await getUser(req);
  if (!user) {
    return { error: new Response(
      JSON.stringify({ error: 'Login diperlukan' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )};
  }
  return { user };
}

/* ── Wajib admin ───────────────────────────────────────────────────────── */
export async function requireAdmin(req) {
  const r = await requireLogin(req);
  if (r.error) return r;
  if (r.user.role !== ROLE.ADMIN) {
    return { error: new Response(
      JSON.stringify({ error: 'Hanya admin' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )};
  }
  return r;
}

/* ── Wajib operator/admin, dan cek meja ──────────────────────────────────
   Operator hanya boleh ubah meja miliknya. Admin boleh semua.
   ──────────────────────────────────────────────────────────────────────── */
export async function requireTableAccess(req, tableId) {
  const r = await requireLogin(req);
  if (r.error) return r;

  if (r.user.role === ROLE.ADMIN) return r;

  if (r.user.role === ROLE.OPERATOR && r.user.meja === Number(tableId)) {
    return r;
  }

  return { error: new Response(
    JSON.stringify({ error: 'Tidak punya akses ke lapangan ini' }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  )};
}

/* ── Cek apakah user boleh mengubah state ────────────────────────────────
   Dipakai action.mjs untuk memastikan hanya meja yang berhak yang diubah.
   ──────────────────────────────────────────────────────────────────────── */
export function canModifyTable(user, tableId) {
  if (!user) return false;
  if (user.role === ROLE.ADMIN) return true;
  if (user.role === ROLE.OPERATOR && user.meja === Number(tableId)) return true;
  return false;
}
