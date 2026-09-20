/* ═══════════════════════════════════════════════════════════════════════════
   GET /api/me — info user yang sedang login
   Dipakai client untuk cek session masih valid atau tidak.
   ═══════════════════════════════════════════════════════════════════════════ */

import { ok, requireMethod } from './_lib/respond.mjs';
import { getUser } from './_lib/auth.mjs';

export default async (req) => {
  const methodErr = requireMethod(req, 'GET');
  if (methodErr) return methodErr;

  const user = await getUser(req);

  if (!user) {
    return ok({ user: null });
  }

  return ok({
    user: {
      username: user.username,
      role: user.role,
      meja: user.meja,
    },
  });
};

export const config = {
  path: '/api/me',
};