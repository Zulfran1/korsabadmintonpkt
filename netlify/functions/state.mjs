/* ═══════════════════════════════════════════════════════════════════════════
   GET /api/state — baca state
   Publik (tanpa login) — display butuh baca state tanpa auth.
   ═══════════════════════════════════════════════════════════════════════════ */

import { ok, requireMethod } from './_lib/respond.mjs';
import { loadState } from './_lib/blob.mjs';
import { defaultState } from './_lib/defaultState.mjs';
import { getUser } from './_lib/auth.mjs';

export function toPublicState(state) {
  return {
    version: state.version,
    updatedAt: state.updatedAt,
    activeMeja: state.activeMeja,
    ratio: state.ratio,
    vtMode: state.vtMode,
    tables: (state.tables || []).map(({ logs, ...table }) => ({ ...table })),
  };
}

export default async (req) => {
  const methodErr = requireMethod(req, 'GET');
  if (methodErr) return methodErr;

  let state = await loadState();

  /* Kalau belum ada state sama sekali → kirim default */
  if (!state) {
    state = defaultState();
  }
  state.loaded ||= {};
  state.results ||= {};
  for (const table of state.tables || []) {
    table.match ??= null;
    table.pool ??= null;
    table.phase ??= null;
    table.status ||= 'waiting';
    table.teamA ||= 'TIM A';
    table.teamB ||= 'TIM B';
    table.categories = Array.isArray(table.categories) ? table.categories : [];
    table.logs ||= [];
    const emptyPlaceholder = !table.match
      && table.teamA === 'TIM A' && table.teamB === 'TIM B'
      && Number(table.scoreA || 0) === 0 && Number(table.scoreB || 0) === 0
      && !table.categories.some(category => category.winner || (category.sets || []).length);
    if (emptyPlaceholder) {
      table.status = 'waiting';
      table.winner = null;
      table.startedAt = null;
      table.finishedAt = null;
      table.logs = [];
    }
  }

  const user = await getUser(req);
  return ok(user ? state : toPublicState(state));
};

export const config = {
  path: '/api/state',
};
