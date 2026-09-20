/* ═══════════════════════════════════════════════════════════════════════════
   STANDINGS — hitung klasemen Pool A & B
   Aturan TM: Menang 2, Kalah 1, WO 0
   Urutan: Poin → Head-to-head → Selisih Partai
   ═══════════════════════════════════════════════════════════════════════════ */
import { SCHEDULE, POOLS } from './config.js';
import { getState } from './state.js';

/* ═══════════════════════════════════════════════════════════════════════════
   HITUNG KLASEMEN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Hitung klasemen dari match yang sudah dimuat & finished di state.
 * Return: { A: [...], B: [...] } — array tim terurut dari juara ke bawah
 */
export function computeStandings() {
  return computeStandingsFromState(getState());
}

export function computeStandingsFromState(state) {

  /* Inisialisasi stats untuk semua tim di POOLS */
  const stats = {};
  ['A', 'B'].forEach(pool => {
    POOLS[pool].forEach(team => {
      stats[team] = {
        name: team,
        pool,
        main: 0,
        menang: 0,
        kalah: 0,
        wo: 0,
        partaiMenang: 0,
        partaiKalah: 0,
        poin: 0,
      };
    });
  });

  /* Iterasi SCHEDULE — hanya match yang sudah finished */
  SCHEDULE.forEach(m => {
    /* Skip kalau bukan match pool */
    if (!m.pool) return;

    const t = state.results?.[m.id];
    if (!t) return;
    if (!t.winner) return;

    const winnerName = t.winner === 'A' ? t.teamA : t.teamB;
    const loserName  = t.winner === 'A' ? t.teamB : t.teamA;

    /* Skip kalau nama tim tidak ada di stats (mungkin typo) */
    if (!stats[winnerName] || !stats[loserName]) return;

    /* Update stats */
    stats[winnerName].main++;
    stats[winnerName].menang++;
    stats[winnerName].poin += 2;
    stats[winnerName].partaiMenang += (t.winner === 'A' ? t.scoreA : t.scoreB);
    stats[winnerName].partaiKalah  += (t.winner === 'A' ? t.scoreB : t.scoreA);

    stats[loserName].main++;
    stats[loserName].kalah++;
    stats[loserName].poin += 1;
    stats[loserName].partaiMenang += (t.winner === 'A' ? t.scoreB : t.scoreA);
    stats[loserName].partaiKalah  += (t.winner === 'A' ? t.scoreA : t.scoreB);
  });

  /* Kelompokkan per pool & urutkan */
  const poolA = POOLS.A.map(name => stats[name]);
  const poolB = POOLS.B.map(name => stats[name]);

  sortStandings(poolA, state);
  sortStandings(poolB, state);

  return { A: poolA, B: poolB };
}

/* ═══════════════════════════════════════════════════════════════════════════
   URUTKAN
   Aturan: Poin → Head-to-head → Selisih Partai → Partai Menang
   ═══════════════════════════════════════════════════════════════════════════ */

function sortStandings(arr, state) {
  arr.sort((a, b) => {
    /* 1. Poin */
    if (b.poin !== a.poin) return b.poin - a.poin;

    /* 2. Head-to-head */
    const h2h = headToHead(state, a.name, b.name);
    if (h2h !== 0) return h2h;

    /* 3. Selisih partai */
    const selisihA = a.partaiMenang - a.partaiKalah;
    const selisihB = b.partaiMenang - b.partaiKalah;
    if (selisihB !== selisihA) return selisihB - selisihA;

    /* 4. Partai menang */
    if (b.partaiMenang !== a.partaiMenang) return b.partaiMenang - a.partaiMenang;

    /* 5. Alfabet sebagai fallback */
    return a.name.localeCompare(b.name);
  });
}

/**
 * Cek head-to-head antara dua tim.
 * Return: -1 kalau A menang, 1 kalau B menang, 0 kalau tidak ketemu
 */
function headToHead(state, nameA, nameB) {
  for (const m of SCHEDULE) {
    if (!m.pool) continue;
    const t = state.results?.[m.id];
    if (!t) continue;

    /* Cek apakah match ini melibatkan A vs B */
    const isA = (t.teamA === nameA && t.teamB === nameB);
    const isB = (t.teamA === nameB && t.teamB === nameA);
    if (!isA && !isB) continue;

    const winnerName = t.winner === 'A' ? t.teamA : t.teamB;
    if (winnerName === nameA) return -1;   // A menang
    if (winnerName === nameB) return 1;    // B menang
  }
  return 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER — tim yang sudah dimainkan
   ═══════════════════════════════════════════════════════════════════════════ */

export function countFinishedMatches() {
  const state = getState();
  let finished = 0, total = 0;
  SCHEDULE.forEach(m => {
    if (!m.pool) return;
    total++;
    if (state.results?.[m.id]) finished++;
  });
  return { finished, total };
}
