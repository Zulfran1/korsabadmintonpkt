/* ═══════════════════════════════════════════════════════════════════════════
   API — wrapper fetch ke server
   Semua komunikasi ke /api/* lewat sini.
   ═══════════════════════════════════════════════════════════════════════════ */

const BASE = '';

/* ── Error khusus API ──────────────────────────────────────────────────── */
export class ApiError extends Error {
  constructor(message, status, extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.extra = extra;
  }
}

/* ── Request dasar ─────────────────────────────────────────────────────── */
async function request(path, options = {}) {
  const opts = {
    credentials: 'same-origin',   // kirim cookie
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let res;
  try {
    res = await fetch(BASE + path, { ...opts, signal: controller.signal });
  } catch (e) {
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    const message = e?.name === 'AbortError'
      ? 'Server terlalu lama merespons. Coba lagi dan periksa koneksi.'
      : local
        ? 'Tidak bisa terhubung ke server lokal. Pastikan “npm run dev” masih berjalan.'
        : 'Tidak bisa terhubung ke server. Periksa internet lalu coba lagi.';
    throw new ApiError(message, 0);
  } finally {
    clearTimeout(timeout);
  }

  /* Parse JSON kalau ada */
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { data = await res.json(); } catch {}
  }

  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, data || {});
  }

  return data;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENDPOINT
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Login ──────────────────────────────────────────────────────────────── */
export async function login(username, password) {
  return request('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

/* ── Logout ─────────────────────────────────────────────────────────────── */
export async function logout() {
  return request('/api/logout', { method: 'POST' });
}

/* ── Info user yang sedang login ────────────────────────────────────────── */
export async function me() {
  try {
    const r = await request('/api/me');
    return r.user || null;
  } catch (e) {
    if (e.status === 401) return null;
    throw e;
  }
}

/* ── Ambil state ────────────────────────────────────────────────────────── */
export async function fetchState() {
  return request('/api/state');
}

/* ── Kirim aksi ─────────────────────────────────────────────────────────── */
export async function action(type, payload = {}) {
  return request('/api/action', {
    method: 'POST',
    body: JSON.stringify({ type, ...payload }),
  });
}

/* ── Shortcut aksi umum ─────────────────────────────────────────────────── */

export const setTeam = (table, side, name, version) =>
  action('set-team', { table, side, name, version });

/* sets = array [{ a, b }, ...] — skor rally per set */
export const setStatus = (table, status, version) =>
  action('set-status', { table, status, version });

export const setCategory = (table, index, sets, version) =>
  action('set-category', { table, index, sets, version });

/* sets = array [{ a, b }, ...] — skor rally per set */
export const clearCategory = (table, index, version) =>
  action('clear-category', { table, index, version });

export const finishMatch = (table, version) =>
  action('finish-match', { table, version });

export const reopenMatch = (table, version) =>
  action('reopen-match', { table, version });

export const toggleDisplay = (table, version) =>
  action('toggle-display', { table, version });

export const resetTable = (table, version) =>
  action('reset-table', { table, version });

export const setActiveMeja = (n, version) =>
  action('set-active', { n, version });

export const setVtMode = (mode, version) =>
  action('set-vt-mode', { mode, version });

export const setRatio = (ratio, version) =>
  action('set-ratio', { ratio, version });

export const addCategory = (table, name, version) =>
  action('add-category', { table, name, version });

export const removeCategory = (table, index, version) =>
  action('remove-category', { table, index, version });

export const renameCategory = (table, index, name, version) =>
  action('rename-category', { table, index, name, version });

export const moveCategory = (table, index, dir, version) =>
  action('move-category', { table, index, dir, version });

export const resetCategories = (table, version) =>
  action('reset-categories', { table, version });

export const loadMatch = (table, payload, version) =>
  action('load-match', { table, ...payload, version });

export const resetAll = (version) =>
  action('reset-all', { version });
