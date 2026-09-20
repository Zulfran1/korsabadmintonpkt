/* ═══════════════════════════════════════════════════════════════════════════
   BLOB — wrapper Netlify Blobs + in-memory fallback
   Kalau Blobs gagal (mis. netlify dev lokal), otomatis pakai Map di memory.
   Data hilang saat restart netlify dev, tapi untuk dev tidak masalah.
   ═══════════════════════════════════════════════════════════════════════════ */

import { getStore } from '@netlify/blobs';

const STATE_KEY = 'korsa2026_badminton_state';
/* Bump namespace saat kredensial dirotasi agar semua sesi lama langsung invalid. */
const SESSION_PREFIX = 'session-v2/';
const LOGIN_ATTEMPT_PREFIX = 'login-attempt/';
const LOG_PREFIX = 'log/';

/* ── In-memory fallback ────────────────────────────────────────────────── */
const memory = new Map();
const memoryEtags = new Map();
let memoryEtagSequence = 0;
let blobsBroken = false;
let blobWarningShown = false;

function memoryFallbackAllowed() {
  /* `node --test` dijalankan juga pada Netlify Build, tempat NETLIFY=true
     tetapi context Blob Functions memang belum tersedia. Izinkan fallback
     hanya di worker test; runtime Functions production tetap fail closed. */
  const isTestRunner = Boolean(process.env.NODE_TEST_CONTEXT)
    || process.execArgv.includes('--test')
    || process.argv.includes('--test');
  if (isTestRunner) return true;
  const isHostedNetlify = String(process.env.NETLIFY).toLowerCase() === 'true'
    && String(process.env.NETLIFY_DEV).toLowerCase() !== 'true';
  return !isHostedNetlify && process.env.NODE_ENV !== 'production';
}

function handleBlobFailure(err) {
  if (!memoryFallbackAllowed()) throw err;
  blobsBroken = true;
  warnOnce(err);
}

function warnOnce(err) {
  if (blobWarningShown) return;
  blobWarningShown = true;
  console.warn('');
  console.warn('⚠  Netlify Blobs tidak tersedia. Pakai in-memory fallback.');
  console.warn('   Data akan HILANG setiap kali netlify dev restart.');
  console.warn('   Di production (Netlify Cloud), Blobs akan otomatis jalan.');
  console.warn('   Error:', err?.message || err);
  console.warn('');
}

function store() {
  if (blobsBroken) return null;
  try {
    return getStore({ name: 'korsa-badminton', consistency: 'strong' });
  } catch (e) {
    handleBlobFailure(e);
    return null;
  }
}

/* ── Helper get/set/delete yang fallback ke memory ────────────────────── */

async function blobGet(key, opts = {}) {
  const s = store();
  if (!s) return memory.get(key) ?? null;
  try {
    const val = await s.get(key, opts);
    return val ?? memory.get(key) ?? null;
  } catch (e) {
    handleBlobFailure(e);
    return memory.get(key) ?? null;
  }
}

async function blobSet(key, value, opts = {}) {
  const s = store();
  if (!s) {
    memory.set(key, value);
    return;
  }
  try {
    if (opts.type === 'json') {
      await s.setJSON(key, value);
    } else {
      await s.set(key, value);
    }
    memory.set(key, value);
  } catch (e) {
    handleBlobFailure(e);
    memory.set(key, value);
  }
}

async function blobDelete(key) {
  const s = store();
  if (!s) {
    memory.delete(key);
    return;
  }
  try {
    await s.delete(key);
    memory.delete(key);
  } catch (e) {
    handleBlobFailure(e);
    memory.delete(key);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════════════════════ */

export async function loadState() {
  return (await blobGet(STATE_KEY, { type: 'json' })) || null;
}

export class StateConflictError extends Error {
  constructor() {
    super('State changed while it was being saved');
    this.name = 'StateConflictError';
  }
}

export async function loadStateForUpdate() {
  const s = store();
  if (!s) {
    return {
      state: memory.has(STATE_KEY) ? structuredClone(memory.get(STATE_KEY)) : null,
      etag: memoryEtags.get(STATE_KEY) ?? null,
      backend: 'memory',
    };
  }

  try {
    const entry = await s.getWithMetadata(STATE_KEY, { type: 'json' });
    return {
      state: entry?.data ?? null,
      etag: entry?.etag ?? null,
      backend: 'blob',
    };
  } catch (e) {
    handleBlobFailure(e);
    return {
      state: memory.has(STATE_KEY) ? structuredClone(memory.get(STATE_KEY)) : null,
      etag: memoryEtags.get(STATE_KEY) ?? null,
      backend: 'memory',
    };
  }
}

export async function saveState(state, guard) {
  if (!guard || !['blob', 'memory'].includes(guard.backend)) {
    throw new TypeError('State save requires a concurrency guard');
  }

  if (guard.backend === 'memory') {
    const currentEtag = memoryEtags.get(STATE_KEY) ?? null;
    if (currentEtag !== guard.etag) throw new StateConflictError();
    const nextEtag = `memory-${++memoryEtagSequence}`;
    memory.set(STATE_KEY, structuredClone(state));
    memoryEtags.set(STATE_KEY, nextEtag);
    return { modified: true, etag: nextEtag };
  }

  const s = store();
  if (!s) throw new Error('Blob store became unavailable during state update');
  /* Netlify Dev memakai Blob sandbox lokal. Sandbox tersebut dapat memberi
     ETag dari getWithMetadata yang selalu ditolak lagi oleh conditional set,
     sehingga setiap aksi valid berakhir 409. Optimistic version check di
     action.mjs tetap melindungi alur lokal; CAS Blob tetap wajib di production. */
  const isLocalDev = String(process.env.NETLIFY_DEV).toLowerCase() === 'true';
  const options = isLocalDev
    ? {}
    : guard.etag
      ? { onlyIfMatch: guard.etag }
      : { onlyIfNew: true };
  const result = await s.setJSON(STATE_KEY, state, options);
  if (!result.modified || (!isLocalDev && !result.etag)) throw new StateConflictError();
  memory.set(STATE_KEY, structuredClone(state));
  return result;
}

export async function saveSession(token, data) {
  await blobSet(SESSION_PREFIX + token, data, { type: 'json' });
}

export async function loadSession(token) {
  if (!token) return null;
  return (await blobGet(SESSION_PREFIX + token, { type: 'json' })) || null;
}

export async function deleteSession(token) {
  if (!token) return;
  await blobDelete(SESSION_PREFIX + token);
}

export async function getLoginAttempts(ip) {
  const data = await blobGet(LOGIN_ATTEMPT_PREFIX + ip, { type: 'json' });
  return data || { count: 0, firstAt: 0 };
}

export async function setLoginAttempts(ip, data) {
  await blobSet(LOGIN_ATTEMPT_PREFIX + ip, data, { type: 'json' });
}

export async function clearLoginAttempts(ip) {
  await blobDelete(LOGIN_ATTEMPT_PREFIX + ip);
}

export async function appendLog(dateKey, entry) {
  const key = LOG_PREFIX + dateKey + '.jsonl';
  const existing = (await blobGet(key, { type: 'text' })) || '';
  const line = JSON.stringify(entry) + '\n';
  await blobSet(key, existing + line, { type: 'text' });
}

export async function loadLog(dateKey) {
  const text = await blobGet(LOG_PREFIX + dateKey + '.jsonl', { type: 'text' });
  if (!text) return [];
  return text.trim().split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

export async function listLogDates() {
  return [];
}
