/* ═══════════════════════════════════════════════════════════════════════════
   STATE — client state + sync ke server
   Model: kategori punya sets[{a,b}], winner & scoreSet dihitung otomatis
   ═══════════════════════════════════════════════════════════════════════════ */

import { MATCH_BY_ID, STORE_KEY, DEFAULT_CATEGORIES, RULES } from './config.js';
import * as api from './api.js';

/* ═══════════════════════════════════════════════════════════════════════════
   ATURAN BULU TANGKIS
   ═══════════════════════════════════════════════════════════════════════════ */

/* Set selesai kalau skor >= 15 DAN selisih >= 2 */
export function setWinner(a, b) {
  a = Number(a);
  b = Number(b);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b) return null;

  const winner = a > b ? 'A' : 'B';
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  const valid = low < RULES.POINTS_TO_WIN - 1
    ? high === RULES.POINTS_TO_WIN
    : high === low + RULES.WIN_BY;
  if (valid) return winner;
  return null;
}

/* Hitung hasil dari daftar set */
export function computeCategoryResult(sets) {
  if (!Array.isArray(sets) || sets.length < 2 || sets.length > RULES.MAX_GAMES) {
    return { winner: null, scoreSet: null, gamesA: 0, gamesB: 0, valid: false };
  }
  let gamesA = 0, gamesB = 0;
  for (let i = 0; i < sets.length; i++) {
    if (gamesA === RULES.GAMES_TO_WIN || gamesB === RULES.GAMES_TO_WIN) {
      return { winner: null, scoreSet: null, gamesA, gamesB, valid: false, reason: 'extra-set' };
    }
    const s = sets[i];
    if (!s || typeof s !== 'object') {
      return { winner: null, scoreSet: null, gamesA, gamesB, valid: false, reason: 'set-invalid' };
    }
    const w = setWinner(s.a, s.b);
    if (!w) {
      return { winner: null, scoreSet: null, gamesA, gamesB, valid: false, reason: 'set-invalid' };
    }
    if (w === 'A') gamesA++; else gamesB++;
  }
  let winner = null;
  if (gamesA >= RULES.GAMES_TO_WIN) winner = 'A';
  else if (gamesB >= RULES.GAMES_TO_WIN) winner = 'B';
  return {
    winner,
    scoreSet: `${gamesA}-${gamesB}`,
    gamesA,
    gamesB,
    valid: winner !== null,
  };
}

/* Hitung skor kontingen */
export function computeScore(categories) {
  let scoreA = 0, scoreB = 0, decided = 0;
  (categories || []).forEach(c => {
    if (c.winner === 'A') { scoreA++; decided++; }
    else if (c.winner === 'B') { scoreB++; decided++; }
  });
  return { scoreA, scoreB, decided, total: (categories || []).length };
}

/* Cek bisa selesai */
export function canFinish(table) {
  if (!table || table.status === 'finished') {
    return { ok: false, reason: 'finished' };
  }
  const cats = table.categories || [];
  const { scoreA, scoreB, decided, total } = computeScore(cats);
  if (decided === 0) return { ok: false, reason: 'undecided', count: cats.length };
  if (table.pool && decided < total) {
    return { ok: false, reason: 'incomplete', decided, total };
  }
  if (!table.pool) {
    const required = Math.floor(total / 2) + 1;
    if (Math.max(scoreA, scoreB) < required) {
      return { ok: false, reason: 'not-clinched', required, a: scoreA, b: scoreB };
    }
  }
  if (scoreA === scoreB) return { ok: false, reason: 'tied', a: scoreA, b: scoreB };
  return { ok: true };
}

/* ═══════════════════════════════════════════════════════════════════════════
   DEFAULT (fallback kalau server belum balas)
   ═══════════════════════════════════════════════════════════════════════════ */

export function defaultCategories() {
  return DEFAULT_CATEGORIES.map(name => ({
    name,
    sets: [],
    winner: null,
    scoreSet: null,
  }));
}

export function defaultTable(id) {
  return {
    id,
    match: null,
    pool: null,
    phase: null,
    teamA: 'TIM A',
    teamB: 'TIM B',
    status: 'waiting',
    hidden: false,
    logs: [],
    categories: defaultCategories(),
    scoreA: 0,
    scoreB: 0,
    winner: null,
    startedAt: null,
    finishedAt: null,
  };
}

export function defaultState() {
  return {
    version: 0,
    updatedAt: 0,
    activeMeja: 4,
    ratio: 'fill',
    vtMode: 'dark',
    loaded: {},
    results: {},
    tables: [1, 2, 3, 4].map(defaultTable),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   STORE
   ═══════════════════════════════════════════════════════════════════════════ */

let state = defaultState();
let ready = false;
let sseConnection = null;
let currentUser = null;
let pollTimer = 0;
let pollingStarted = false;
let broadcastChannel = null;
let acceptBroadcast = false;

const STATE_CACHE_KEY = `${STORE_KEY}_public_cache`;
const STATE_CACHE_MAX_AGE = 6 * 60 * 60 * 1000;

const listeners = new Set();
const readyResolvers = [];

export function subscribe(fn, { immediate = true } = {}) {
  listeners.add(fn);
  if (ready && immediate) { try { fn(state); } catch (e) {} }
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach(fn => { try { fn(state); } catch (e) {} });
}

export function whenReady() {
  if (ready) return Promise.resolve(state);
  return new Promise(resolve => readyResolvers.push(resolve));
}

function markReady() {
  if (ready) return;
  ready = true;
  readyResolvers.forEach(r => r(state));
  readyResolvers.length = 0;
}

export function replaceState(next, {
  force = false,
  persist = true,
  broadcast = true,
} = {}) {
  if (!next || typeof next !== 'object') return;
  next.loaded ||= {};
  next.results ||= {};
  next.tables = Array.isArray(next.tables) ? next.tables : [];
  for (const table of next.tables) {
    /* Migrasi state lama: field yang belum ada tidak boleh dianggap aktif. */
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
  if (!force && typeof next.version === 'number' && next.version < state.version) return;

  /* Skip kalau version sama & sudah ready — polling tanpa perubahan */
  if (typeof next.version === 'number' &&
      next.version === state.version &&
      ready && !force) {
    return;
  }

  state = next;
  if (persist) savePublicCache(next);
  markReady();
  notify();
  if (broadcast) publishPublicState(next);
}

function publicSnapshot(source) {
  return {
    version: source.version,
    updatedAt: source.updatedAt,
    activeMeja: source.activeMeja,
    ratio: source.ratio,
    vtMode: source.vtMode,
    loaded: {},
    results: {},
    tables: (source.tables || []).map(({ logs, ...table }) => ({
      ...table,
      logs: [],
    })),
  };
}

function savePublicCache(source) {
  if (typeof localStorage === 'undefined' || !Array.isArray(source?.tables)) return;
  try {
    localStorage.setItem(STATE_CACHE_KEY, JSON.stringify({
      cachedAt: Date.now(),
      state: publicSnapshot(source),
    }));
  } catch {}
}

function loadPublicCache() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const cached = JSON.parse(localStorage.getItem(STATE_CACHE_KEY) || 'null');
    if (!cached?.state || !Number.isFinite(cached.cachedAt)) return null;
    if (Date.now() - cached.cachedAt > STATE_CACHE_MAX_AGE) return null;
    return cached.state;
  } catch {
    return null;
  }
}

/* BroadcastChannel membuat Admin/Controller dan Display/TV di browser yang
   sama tersinkron langsung. Hanya snapshot publik yang dikirim; halaman
   berprivilege tidak menerima snapshot ini agar data admin tidak terpotong. */
function initBroadcastSync({ accept = false } = {}) {
  acceptBroadcast ||= accept;
  if (broadcastChannel || typeof window === 'undefined' ||
      typeof window.BroadcastChannel !== 'function') return;
  try {
    broadcastChannel = new window.BroadcastChannel(`${STORE_KEY}_state`);
    broadcastChannel.addEventListener('message', event => {
      if (!acceptBroadcast || !event.data) return;
      replaceState(event.data, { persist: true, broadcast: false });
    });
  } catch {
    broadcastChannel = null;
  }
}

function publishPublicState(source) {
  if (!broadcastChannel) return;
  try { broadcastChannel.postMessage(publicSnapshot(source)); } catch {}
}

/* ═══════════════════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════════════════ */

async function loadInitialState() {
  try {
    const s = await api.fetchState();
    /* Server selalu sumber kebenaran, termasuk setelah storage restart. */
    replaceState(s, { force: true });
  } catch (e) {
    console.error('[state] gagal fetch state:', e);
    markReady();
  }
}

export async function initState({ eager = false, poll = true } = {}) {
  initBroadcastSync({ accept: eager });
  if (eager) {
    const cached = loadPublicCache();
    if (cached) replaceState(cached, { force: true, persist: false, broadcast: false });
    else markReady();

    /* Display/TV langsung render; state server menyusul tanpa memblokir UI. */
    void loadInitialState();
  } else {
    await loadInitialState();
  }

  /* TODO Fase 5: aktifkan SSE */
  // connectSSE();

  if (poll) startPolling();
}

export function startStatePolling() {
  startPolling();
}

/* Poll berantai mencegah request menumpuk ketika Blob/network sedang lambat.
   Tab background diperlambat supaya beberapa controller + admin + display
   tidak membanjiri function secara bersamaan. */
function startPolling() {
  if (pollingStarted) return;
  pollingStarted = true;

  const delay = () => document.hidden ? 12000 : 3000;
  const poll = async () => {
    try {
      const s = await api.fetchState();
      replaceState(s);
    } catch {}
    pollTimer = window.setTimeout(poll, delay());
  };

  const schedule = (ms = delay()) => {
    clearTimeout(pollTimer);
    pollTimer = window.setTimeout(poll, ms);
  };

  document.addEventListener('visibilitychange', () => {
    schedule(document.hidden ? delay() : 0);
  });
  schedule();
}

/* ═══════════════════════════════════════════════════════════════════════════
   SSE (belum aktif)
   ═══════════════════════════════════════════════════════════════════════════ */

function connectSSE() {
  if (sseConnection) { try { sseConnection.close(); } catch {} sseConnection = null; }
  try {
    const es = new EventSource('/api/stream');
    sseConnection = es;
    es.addEventListener('state', ev => {
      try { replaceState(JSON.parse(ev.data)); } catch {}
    });
    es.onerror = () => {
      try { es.close(); } catch {}
      sseConnection = null;
      setTimeout(connectSSE, 5000);
    };
  } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC
   ═══════════════════════════════════════════════════════════════════════════ */

export function getState() { return state; }
export function isReady() { return ready; }
export function getTable(id) { return state.tables.find(t => t.id === id); }
export function setCurrentUser(u) { currentUser = u; }
export function getCurrentUser() { return currentUser; }

/* ═══════════════════════════════════════════════════════════════════════════
   SEND — wrapper ke API
   ═══════════════════════════════════════════════════════════════════════════ */

async function send(actionFn, { retryOnConflict = true } = {}) {
  const maxAttempts = retryOnConflict ? 3 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await actionFn();
      if (res && res.state) replaceState(res.state);
      return res?.result || { ok: true };
    } catch (e) {
      if (e.status !== 409) throw e;
      try {
        const latest = await api.fetchState();
        /* Konflik dapat terjadi setelah server restart ketika versi tab lama
           lebih tinggi daripada storage lokal yang baru aktif. Pada jalur
           recovery, server harus selalu menjadi sumber kebenaran. */
        replaceState(latest, { force: true });
      } catch {
        throw new Error('Data berubah dan versi terbaru gagal dimuat. Periksa koneksi server.');
      }
      if (attempt === maxAttempts) {
        throw new Error('Data baru saja berubah di perangkat lain. Silakan coba sekali lagi.');
      }
    }
  }
  throw new Error('Aksi gagal diproses');
}

/* ═══════════════════════════════════════════════════════════════════════════
   PREFERENSI
   ═══════════════════════════════════════════════════════════════════════════ */

export async function setActiveMeja(n) {
  if (![1, 2, 3, 4].includes(n)) return;
  return send(() => api.setActiveMeja(n, state.version));
}

export async function setVtMode(mode) {
  const m = (mode === 'light') ? 'light' : 'dark';
  return send(() => api.setVtMode(m, state.version));
}
export async function toggleVtMode() {
  return setVtMode(state.vtMode === 'dark' ? 'light' : 'dark');
}

export async function setRatio(r) {
  const ratio = (r === 'square') ? 'square' : 'fill';
  return send(() => api.setRatio(ratio, state.version));
}
export async function toggleRatio() {
  return setRatio(state.ratio === 'fill' ? 'square' : 'fill');
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIM
   ═══════════════════════════════════════════════════════════════════════════ */

export async function setTeam(id, side, name) {
  const v = String(name || '').toUpperCase();
  return send(() => api.setTeam(id, side, v, state.version));
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATUS
   ═══════════════════════════════════════════════════════════════════════════ */

export async function setStatus(id, status) {
  if (!['waiting', 'live', 'finished'].includes(status)) return;
  return send(() => api.setStatus(id, status, state.version));
}

export async function toggleTableDisplay(id) {
  return send(() => api.toggleDisplay(id, state.version));
}

export async function resetTable(id) {
  return send(() => api.resetTable(id, state.version));
}

export async function resetAll() {
  return send(() => api.resetAll(state.version));
}

/* ═══════════════════════════════════════════════════════════════════════════
   KATEGORI — input set rally
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Simpan hasil kategori dengan daftar set rally.
 * @param {number} id     meja id
 * @param {number} index  index kategori
 * @param {Array}  sets   [{ a, b }, ...] skor rally per set
 */
export async function setCategorySets(id, index, sets) {
  /* Validasi lokal dulu */
  const result = computeCategoryResult(sets);
  if (!result.valid) {
    throw new Error('Skor set tidak valid — pastikan setiap set selesai (min 15, selisih 2)');
  }
  return send(
    () => api.setCategory(id, index, sets, state.version),
    { retryOnConflict: true },
  );
}

export async function clearCategoryResult(id, index) {
  return send(() => api.clearCategory(id, index, state.version));
}

export async function addCategory(id, name) {
  return send(() => api.addCategory(id, name, state.version));
}

export async function removeCategory(id, index) {
  const t = getTable(id);
  const cat = t && t.categories[index];
  if (cat && cat.winner) {
    throw new Error('Tidak bisa hapus kategori yang sudah ada pemenang');
  }
  return send(() => api.removeCategory(id, index, state.version), { retryOnConflict: false });
}

export async function renameCategory(id, index, name) {
  const n = String(name || '').trim();
  if (!n) return;
  return send(() => api.renameCategory(id, index, n, state.version));
}

export async function moveCategory(id, index, dir) {
  const t = getTable(id);
  const target = index + dir;
  if (!t || target < 0 || target >= t.categories.length) return;
  return send(() => api.moveCategory(id, index, dir, state.version), { retryOnConflict: false });
}

export async function resetCategories(id) {
  return send(() => api.resetCategories(id, state.version));
}

/* ═══════════════════════════════════════════════════════════════════════════
   SELESAIKAN / BUKA
   ═══════════════════════════════════════════════════════════════════════════ */

export async function finishMatch(id) {
  const t = getTable(id);
  const check = canFinish(t);
  if (!check.ok) throw new Error(finishReason(check));
  return send(() => api.finishMatch(id, state.version));
}

export async function reopenMatch(id) {
  const t = getTable(id);
  if (!t || t.status !== 'finished') return;
  return send(() => api.reopenMatch(id, state.version));
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

/* ═══════════════════════════════════════════════════════════════════════════
   JADWAL
   ═══════════════════════════════════════════════════════════════════════════ */

export async function loadMatch(matchId) {
  const m = MATCH_BY_ID[matchId];
  if (!m) throw new Error('Jadwal tidak ditemukan');
  const targets = Array.isArray(m.mejas) ? m.mejas : [m.meja].filter(Boolean);
  if (!targets.length) throw new Error('Pasangan lapangan belum diatur');
  /* Jadwal adalah aksi admin yang jarang dilakukan tetapi berdampak besar.
     Ambil versi server terbaru sebelum POST agar tab yang lama terbuka tidak
     mengirim optimistic-lock version yang kedaluwarsa. */
  const latest = await api.fetchState();
  replaceState(latest, { force: true });
  return send(() => api.loadMatch(targets[0], {
    tables: targets,
    match: matchId,
    pool: m.pool,
    phase: m.phase,
    teamA: m.teamA,
    teamB: m.teamB,
  }, state.version));
}

export function isTableBusy(id) {
  const t = getTable(id);
  if (!t) return false;
  const hasResult = (t.categories || []).some(c => c.winner || (c.sets || []).length > 0);
  const hasScore = Number(t.scoreA) > 0 || Number(t.scoreB) > 0;
  const emptyPlaceholder = !t.match && !hasResult && !hasScore
    && (t.teamA || 'TIM A') === 'TIM A' && (t.teamB || 'TIM B') === 'TIM B';
  if (emptyPlaceholder) return false;
  return Boolean(t.match) || (t.status || 'waiting') !== 'waiting' || hasResult || hasScore;
}
