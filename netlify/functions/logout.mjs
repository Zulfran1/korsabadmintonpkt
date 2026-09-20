/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/logout — logout
   Hapus session di server + clear cookie.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  ok, requireMethod, withCookie,
} from './_lib/respond.mjs';
import { destroySession, COOKIE_OPTS } from './_lib/session.mjs';
import { getUser, COOKIE_NAME } from './_lib/auth.mjs';

export default async (req) => {
  const methodErr = requireMethod(req, 'POST');
  if (methodErr) return methodErr;

  const user = await getUser(req);
  if (user) {
    await destroySession(user.token);
  }

  const res = ok({ loggedOut: true });

  /* Clear cookie dengan Max-Age=0 */
  withCookie(res, COOKIE_NAME, '', {
    ...COOKIE_OPTS,
    maxAge: 0,
  });

  return res;
};

export const config = {
  path: '/api/logout',
};