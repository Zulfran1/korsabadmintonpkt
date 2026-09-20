/* ═══════════════════════════════════════════════════════════════════════════
   DEFAULT STATE — struktur sama persis dengan js/state.js (client)
   ═══════════════════════════════════════════════════════════════════════════ */

const DEFAULT_CATEGORIES = [
  'Ganda Putra Bebas (TKO)',
  'Ganda Putri',
  'Ganda Putra Esselon',
  'Ganda Putra Bebas (TKO)',
  'Ganda Putra 40+',
  'Ganda Putra Bebas (TKO)',
  'Ganda Putra Bebas (Pasangan TKO & TKO)',
];

/* ── Bikin kategori baru ────────────────────────────────────────────────── */
function defaultCategories() {
  return DEFAULT_CATEGORIES.map(name => ({
    name,
    sets: [],       // array { a, b } — diisi operator
    winner: null,   // 'A' | 'B' | null — dihitung otomatis
    scoreSet: null, // '2-0' | '2-1' | dst — dihitung otomatis
  }));
}

/* ── Bikin tabel meja baru ──────────────────────────────────────────────── */
function defaultTable(id) {
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

/* ── State default ──────────────────────────────────────────────────────── */
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

export { DEFAULT_CATEGORIES };
