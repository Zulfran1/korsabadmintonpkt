/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/action — ubah state
   Wajib login. Operator hanya boleh ubah meja miliknya.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  ok, badRequest, forbidden, conflict,
  readJSON, requireMethod,
} from './_lib/respond.mjs';
import {
  loadStateForUpdate, saveState, StateConflictError,
} from './_lib/blob.mjs';
import { defaultState } from './_lib/defaultState.mjs';
import { getUser, canModifyTable, ROLE } from './_lib/auth.mjs';
import {
  computeCategoryResult, computeScore, canFinish,
} from './_lib/badminton.mjs';

const MAX_TEAM_NAME = 60;
const MAX_CATEGORY_NAME = 40;
const MAX_CATEGORIES = 20;

/* ═══════════════════════════════════════════════════════════════════════════
   HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */

export default async (req) => {
  const methodErr = requireMethod(req, 'POST');
  if (methodErr) return methodErr;

  /* Pembacaan session, body, dan state tidak saling bergantung. Menjalankannya
     paralel memangkas satu round-trip Blob pada setiap klik operator. */
  const [user, body, stateGuard] = await Promise.all([
    getUser(req),
    readJSON(req),
    loadStateForUpdate(),
  ]);
  if (!user) return forbidden('Login diperlukan');

  if (!body) return badRequest('Body JSON tidak valid');

  const { type, version, ...payload } = body;
  if (!type) return badRequest('Field "type" wajib');
  if (!Number.isInteger(version) || version < 0) {
    return badRequest('Field "version" wajib berupa bilangan bulat');
  }

  let state = stateGuard.state;
  if (!state) state = defaultState();
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
    table.logs = Array.isArray(table.logs) ? table.logs : [];
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

  /* Optimistic locking */
  if (version !== state.version) {
    return conflict('State sudah berubah, muat ulang halaman', {
      serverVersion: state.version,
    });
  }

  /* Otorisasi */
  const check = authorizeAction(user, state, type, payload);
  if (check.error) return check.error;

  /* Terapkan aksi */
  const result = applyAction(state, user, type, payload);
  if (result.error) return result.error;
  if (result.unchanged) return ok({ state, result: result.data || {} });

  /* Bump version */
  state.version++;
  state.updatedAt = Date.now();
  try {
    await saveState(state, stateGuard);
  } catch (error) {
    if (error instanceof StateConflictError) {
      return conflict('State sudah berubah, muat ulang halaman');
    }
    throw error;
  }

  return ok({ state, result: result.data || {} });
};

/* ═══════════════════════════════════════════════════════════════════════════
   OTORISASI
   ═══════════════════════════════════════════════════════════════════════════ */

function authorizeAction(user, state, type, payload) {
  const tableId = payload.table;

  switch (type) {
    case 'set-active':
    case 'set-vt-mode':
    case 'set-ratio':
    case 'reset-all':
    case 'load-match':
      if (user.role !== ROLE.ADMIN) return { error: forbidden('Hanya admin') };
      return { ok: true };

    case 'set-team':
    case 'set-status':
    case 'toggle-display':
    case 'reset-table':
    case 'set-category':
    case 'clear-category':
    case 'finish-match':
    case 'reopen-match':
    case 'add-category':
    case 'remove-category':
    case 'rename-category':
    case 'move-category':
    case 'reset-categories':
      if (!tableId) return { error: badRequest('Field "table" wajib') };
      if (!canModifyTable(user, tableId)) return { error: forbidden('Tidak punya akses ke lapangan ini') };
      return { ok: true };

    default:
      return { error: badRequest(`Aksi "${type}" tidak dikenal`) };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   TERAPKAN AKSI
   ═══════════════════════════════════════════════════════════════════════════ */

function getTable(state, id) {
  return state.tables.find(t => t.id === Number(id));
}

function linkedTables(state, table) {
  if (!table?.match) return table ? [table] : [];
  return state.tables.filter(candidate => candidate.match === table.match);
}

function syncLinkedMatch(state, source) {
  for (const target of linkedTables(state, source)) {
    if (target.id === source.id) continue;
    Object.assign(target, {
      match: source.match,
      pool: source.pool,
      phase: source.phase,
      teamA: source.teamA,
      teamB: source.teamB,
      status: source.status,
      categories: source.categories.map(category => ({
        ...category,
        sets: category.sets.map(set => ({ ...set })),
      })),
      scoreA: source.scoreA,
      scoreB: source.scoreB,
      winner: source.winner,
      startedAt: source.startedAt,
      finishedAt: source.finishedAt,
      logs: (source.logs || []).map(log => ({ ...log })),
    });
  }
}

function resetTableSlot(table) {
  const fresh = defaultState().tables.find(candidate => candidate.id === table.id);
  Object.assign(table, fresh);
}

function categoryIndex(value, categories) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < categories.length ? index : null;
}

function applyAction(state, user, type, p) {
  const table = p.table ? getTable(state, p.table) : null;
  if (table) table.logs ||= [];

  const requiresReopen = new Set([
    'set-team', 'set-category', 'clear-category', 'reset-table',
    'add-category', 'remove-category', 'rename-category', 'move-category',
    'reset-categories',
  ]);
  if (table?.status === 'finished' && requiresReopen.has(type)) {
    return { error: badRequest('Buka kembali pertandingan sebelum mengubah hasil') };
  }

  switch (type) {

    /* ── Preferensi ───────────────────────────────────────────────── */
    case 'set-active':
      if (![1, 2, 3, 4].includes(Number(p.n))) return { error: badRequest('n harus 1–4') };
      state.activeMeja = Number(p.n);
      return { data: { activeMeja: state.activeMeja } };

    case 'set-vt-mode':
      state.vtMode = (p.mode === 'light') ? 'light' : 'dark';
      return { data: { vtMode: state.vtMode } };

    case 'set-ratio':
      state.ratio = (p.ratio === 'square') ? 'square' : 'fill';
      return { data: { ratio: state.ratio } };

    case 'reset-all':
      {
        const { version, updatedAt } = state;
        const fresh = defaultState();
        fresh.version = version;
        fresh.updatedAt = updatedAt;
        Object.assign(state, fresh);
      }
      return { data: { reset: true } };

    /* ── Tim ──────────────────────────────────────────────────────── */
    case 'set-team':
      if (!table) return { error: badRequest('Lapangan tidak ditemukan') };
      {
        const name = String(p.name || '').trim().toUpperCase();
        if (!name) return { error: badRequest('Nama tim tidak boleh kosong') };
        if (name.length > MAX_TEAM_NAME) return { error: badRequest(`Nama tim maksimal ${MAX_TEAM_NAME} karakter`) };
        if (p.side === 'A') table.teamA = name;
        else if (p.side === 'B') table.teamB = name;
        else return { error: badRequest('side harus A atau B') };
        syncLinkedMatch(state, table);
      }
      return { data: { tableA: table.teamA, tableB: table.teamB } };

    /* ── Status ───────────────────────────────────────────────────── */
    case 'set-status':
      if (!table) return { error: badRequest('Lapangan tidak ditemukan') };
      if (!['waiting', 'live', 'finished'].includes(p.status)) {
        return { error: badRequest('Status tidak valid') };
      }
      if (p.status === 'finished' && table.status !== 'finished') {
        const check = canFinish(table);
        if (!check.ok) return { error: badRequest(finishReason(check), check) };
        table.winner = table.scoreA > table.scoreB ? 'A' : 'B';
        table.finishedAt = Date.now();
      }
      table.status = p.status;
      if (p.status === 'live' && !table.startedAt) table.startedAt = Date.now();
      if (p.status !== 'finished') {
        table.hidden = false;
        table.finishedAt = null;
        table.winner = null;
        if (p.status === 'waiting') table.startedAt = null;
        if (table.match) delete state.results[table.match];
      }
      if (p.status === 'finished') {
        archiveResult(state, table);
        appendTableLog(table, user, `Pertandingan selesai — ${winnerName(table)} menang ${table.scoreA}–${table.scoreB}`);
      } else {
        appendTableLog(table, user, `Status pertandingan diubah menjadi ${p.status}`);
      }
      syncLinkedMatch(state, table);
      return { data: { status: table.status } };

    case 'finish-match':
      if (!table) return { error: badRequest('Lapangan tidak ditemukan') };
      {
        const check = canFinish(table);
        if (!check.ok) return { error: badRequest(finishReason(check), check) };
        table.winner = table.scoreA > table.scoreB ? 'A' : 'B';
        table.status = 'finished';
        table.finishedAt = Date.now();
        archiveResult(state, table);
        appendTableLog(table, user, `Pertandingan selesai — ${winnerName(table)} menang ${table.scoreA}–${table.scoreB}`);
        syncLinkedMatch(state, table);
      }
      return { data: { winner: table.winner } };

    case 'reopen-match':
      if (!table) return { error: badRequest('Lapangan tidak ditemukan') };
      table.status = 'live';
      table.winner = null;
      table.finishedAt = null;
      if (table.match) delete state.results[table.match];
      appendTableLog(table, user, 'Pertandingan dibuka kembali');
      syncLinkedMatch(state, table);
      return { data: { status: 'live' } };

    case 'toggle-display':
      if (!table) return { error: badRequest('Lapangan tidak ditemukan') };
      {
        const hidden = !table.hidden;
        for (const linked of linkedTables(state, table)) linked.hidden = hidden;
        return { data: { hidden } };
      }

    case 'reset-table':
      if (!table) return { error: badRequest('Lapangan tidak ditemukan') };
      {
        const { match, pool, phase, teamA, teamB, categories, id } = table;
        Object.assign(table, {
          id, match, pool, phase, teamA, teamB,
          status: 'waiting',
          hidden: false,
          logs: [],
          categories: categories.map(c => ({ ...c, sets: [], winner: null, scoreSet: null })),
          scoreA: 0,
          scoreB: 0,
          winner: null,
          startedAt: null,
          finishedAt: null,
        });
        appendTableLog(table, user, 'Skor pertandingan dinolkan');
        syncLinkedMatch(state, table);
      }
      return { data: { reset: true } };

    /* ── Kategori ─────────────────────────────────────────────────── */
    case 'set-category':
      if (!table) return { error: badRequest('Lapangan tidak ditemukan') };
      {
        const idx = categoryIndex(p.index, table.categories);
        if (idx === null) return { error: badRequest('Index kategori tidak valid') };
        const cat = table.categories[idx];
        if (!Array.isArray(p.sets)) return { error: badRequest('sets harus array') };
        const sets = p.sets.map(set => ({ a: Number(set?.a), b: Number(set?.b) }));

        /* Validasi pakai aturan bulu tangkis */
        const result = computeCategoryResult(sets);
        if (!result.valid) {
          return { error: badRequest('Skor set tidak valid — pastikan setiap set selesai (min 15, selisih 2)', result) };
        }

        if (sameSets(cat.sets, sets) && cat.winner === result.winner && cat.scoreSet === result.scoreSet) {
          return {
            unchanged: true,
            data: { scoreA: table.scoreA, scoreB: table.scoreB, unchanged: true },
          };
        }

        cat.sets = sets;
        cat.winner = result.winner;
        cat.scoreSet = result.scoreSet;

        /* Update skor kontingen */
        const { scoreA, scoreB } = computeScore(table.categories);
        table.scoreA = scoreA;
        table.scoreB = scoreB;

        if (table.status === 'waiting') {
          table.status = 'live';
          table.startedAt = table.startedAt || Date.now();
        }
        const categoryWinner = result.winner === 'A' ? table.teamA : table.teamB;
        appendTableLog(
          table,
          user,
          `${cat.name} — ${categoryWinner} menang ${result.scoreSet} (${formatRally(cat.sets)}) di Lapangan ${table.id}`,
        );
        syncLinkedMatch(state, table);
      }
      return { data: { scoreA: table.scoreA, scoreB: table.scoreB } };

    case 'clear-category':
      if (!table) return { error: badRequest('Lapangan tidak ditemukan') };
      {
        const idx = categoryIndex(p.index, table.categories);
        if (idx === null) return { error: badRequest('Index kategori tidak valid') };
        const cat = table.categories[idx];
        cat.sets = [];
        cat.winner = null;
        cat.scoreSet = null;
        const { scoreA, scoreB } = computeScore(table.categories);
        table.scoreA = scoreA;
        table.scoreB = scoreB;
        if (scoreA === 0 && scoreB === 0) {
          table.status = 'waiting';
          table.startedAt = null;
        }
        appendTableLog(table, user, `${cat.name} — hasil dihapus`);
        syncLinkedMatch(state, table);
      }
      return { data: { scoreA: table.scoreA, scoreB: table.scoreB } };

    case 'add-category':
      if (!table) return { error: badRequest('Lapangan tidak ditemukan') };
      {
        if (table.categories.length >= MAX_CATEGORIES) {
          return { error: badRequest(`Maksimal ${MAX_CATEGORIES} kategori per pertandingan`) };
        }
        const rawName = String(p.name || 'Kategori Baru').trim();
        if (!rawName) return { error: badRequest('Nama kategori tidak boleh kosong') };
        if (rawName.length > MAX_CATEGORY_NAME) {
          return { error: badRequest(`Nama kategori maksimal ${MAX_CATEGORY_NAME} karakter`) };
        }
        const name = rawName;
        table.categories.push({ name, sets: [], winner: null, scoreSet: null });
        syncLinkedMatch(state, table);
      }
      return { data: { count: table.categories.length } };

    case 'remove-category':
      if (!table) return { error: badRequest('Lapangan tidak ditemukan') };
      {
        const idx = categoryIndex(p.index, table.categories);
        if (idx === null) return { error: badRequest('Index kategori tidak valid') };
        const cat = table.categories[idx];
        if (cat.winner) return { error: badRequest('Tidak bisa hapus kategori yang sudah ada pemenang') };
        table.categories.splice(idx, 1);
        syncLinkedMatch(state, table);
      }
      return { data: { count: table.categories.length } };

    case 'rename-category':
      if (!table) return { error: badRequest('Lapangan tidak ditemukan') };
      {
        const idx = categoryIndex(p.index, table.categories);
        if (idx === null) return { error: badRequest('Index kategori tidak valid') };
        const cat = table.categories[idx];
        const name = String(p.name || '').trim();
        if (!name) return { error: badRequest('Nama kategori tidak boleh kosong') };
        if (name.length > MAX_CATEGORY_NAME) {
          return { error: badRequest(`Nama kategori maksimal ${MAX_CATEGORY_NAME} karakter`) };
        }
        cat.name = name;
        syncLinkedMatch(state, table);
      }
      return { data: { ok: true } };

    case 'move-category':
      if (!table) return { error: badRequest('Lapangan tidak ditemukan') };
      {
        const idx = categoryIndex(p.index, table.categories);
        const dir = Number(p.dir);
        if (idx === null || ![-1, 1].includes(dir)) {
          return { error: badRequest('Index atau arah kategori tidak valid') };
        }
        const target = idx + dir;
        if (target < 0 || target >= table.categories.length) {
          return { error: badRequest('Tidak bisa dipindah') };
        }
        const [cat] = table.categories.splice(idx, 1);
        table.categories.splice(target, 0, cat);
        syncLinkedMatch(state, table);
      }
      return { data: { ok: true } };

    case 'reset-categories':
      if (!table) return { error: badRequest('Lapangan tidak ditemukan') };
      {
        const DEFAULT_CATEGORIES = [
          'Ganda Putra Bebas (TKO)',
          'Ganda Putri',
          'Ganda Putra Esselon',
          'Ganda Putra Bebas (TKO)',
          'Ganda Putra 40+',
          'Ganda Putra Bebas (TKO)',
          'Ganda Putra Bebas (Pasangan TKO & TKO)',
        ];
        table.categories = DEFAULT_CATEGORIES.map(name => ({
          name, sets: [], winner: null, scoreSet: null,
        }));
        table.scoreA = 0;
        table.scoreB = 0;
        table.winner = null;
        syncLinkedMatch(state, table);
      }
      return { data: { ok: true } };

    /* ── Jadwal ───────────────────────────────────────────────────── */
    case 'load-match':
      {
        const tableIds = [...new Set((Array.isArray(p.tables) ? p.tables : [p.table])
          .map(Number)
          .filter(id => Number.isInteger(id) && id >= 1 && id <= 4))];
        if (!tableIds.length) return { error: badRequest('Pasangan lapangan tidak valid') };
        const targets = tableIds.map(id => getTable(state, id)).filter(Boolean);
        if (targets.length !== tableIds.length) return { error: badRequest('Lapangan tidak ditemukan') };

        const teamA = String(p.teamA || 'TIM A').trim().toUpperCase();
        const teamB = String(p.teamB || 'TIM B').trim().toUpperCase();
        const matchId = p.match ? String(p.match).trim() : null;
        if (!teamA || !teamB || teamA.length > MAX_TEAM_NAME || teamB.length > MAX_TEAM_NAME) {
          return { error: badRequest(`Nama tim wajib diisi dan maksimal ${MAX_TEAM_NAME} karakter`) };
        }
        if (matchId && matchId.length > 20) return { error: badRequest('ID pertandingan maksimal 20 karakter') };
        const pool = p.pool || null;
        const phase = p.phase || null;
        const existingSource = targets.find(target => target.match === matchId) || null;
        const categories = targets[0].categories.map(category => ({
          name: category.name,
          sets: [],
          winner: null,
          scoreSet: null,
        }));

        /* Lapangan final 2+4 dapat menggantikan pasangan lama 1+2 dan 3+4.
           Bersihkan partner yang tidak lagi menjadi target agar videotron tidak
           menampilkan pertandingan lama sebagai duplikat. */
        const displacedMatches = new Set(
          targets.map(target => target.match).filter(oldMatch => oldMatch && oldMatch !== matchId),
        );
        for (const candidate of state.tables) {
          if (!tableIds.includes(candidate.id) && displacedMatches.has(candidate.match)) {
            resetTableSlot(candidate);
          }
        }

        for (const [loadedMatch, loadedTables] of Object.entries(state.loaded)) {
          const ids = Array.isArray(loadedTables) ? loadedTables : [loadedTables];
          if (ids.some(id => tableIds.includes(Number(id)))) delete state.loaded[loadedMatch];
        }

        if (existingSource) {
          for (const target of targets) {
            target.match = matchId;
            target.hidden = false;
          }
          appendTableLog(existingSource, user, `Jadwal ${matchId || '-'} diperluas ke Lapangan ${tableIds.join(' dan ')}`);
          syncLinkedMatch(state, existingSource);
        } else {
          for (const target of targets) {
            Object.assign(target, {
              id: target.id,
              match: matchId,
              pool,
              phase,
              teamA, teamB,
              status: 'waiting',
              hidden: false,
              logs: [],
              categories: categories.map(category => ({ ...category, sets: [] })),
              scoreA: 0,
              scoreB: 0,
              winner: null,
              startedAt: null,
              finishedAt: null,
            });
          }
          appendTableLog(targets[0], user, `Jadwal ${matchId || '-'} dimuat ke Lapangan ${tableIds.join(' dan ')}: ${teamA} vs ${teamB}`);
          syncLinkedMatch(state, targets[0]);
        }

        if (matchId) {
          state.loaded[matchId] = tableIds;
          if (!existingSource) delete state.results[matchId];
        }
        return { data: { match: matchId, tables: tableIds } };
      }

    default:
      return { error: badRequest(`Aksi "${type}" tidak dikenal`) };
  }
}

function finishReason(check) {
  switch (check.reason) {
    case 'undecided': return `Belum ada kategori yang dimainkan`;
    case 'incomplete': return `Penyisihan harus menyelesaikan semua kategori (${check.decided}/${check.total})`;
    case 'not-clinched': return `Babak gugur membutuhkan ${check.required} kemenangan`;
    case 'tied':      return `Skor seri ${check.a}–${check.b}`;
    default:          return 'Belum bisa diselesaikan';
  }
}

function winnerName(table) {
  return table.winner === 'A' ? table.teamA : table.teamB;
}

function formatRally(sets) {
  return (sets || []).map(set => `${set.a}–${set.b}`).join(' · ');
}

function sameSets(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((set, index) => (
    Number(set.a) === Number(right[index]?.a) && Number(set.b) === Number(right[index]?.b)
  ));
}

function appendTableLog(table, user, message) {
  table.logs ||= [];
  table.logs.unshift({
    at: Date.now(),
    by: user?.username || 'system',
    message,
  });
  table.logs = table.logs.slice(0, 10);
}

function archiveResult(state, table) {
  if (!table.match) return;
  state.results[table.match] = {
    match: table.match,
    table: table.id,
    tables: linkedTables(state, table).map(linked => linked.id),
    pool: table.pool || null,
    phase: table.phase || null,
    teamA: table.teamA,
    teamB: table.teamB,
    scoreA: table.scoreA,
    scoreB: table.scoreB,
    winner: table.winner,
    categories: table.categories.map(category => ({
      ...category,
      sets: category.sets.map(set => ({ ...set })),
    })),
    startedAt: table.startedAt,
    finishedAt: table.finishedAt,
  };
}

export const config = { path: '/api/action' };
