/* ═══════════════════════════════════════════════════════════════════════════
   BADMINTON — aturan bulu tangkis KORSA
   15 poin, deuce 14-14 tanpa cap, best of 3
   ═══════════════════════════════════════════════════════════════════════════ */

export const RULES = {
  POINTS_TO_WIN: 15,
  WIN_BY: 2,
  GAMES_TO_WIN: 2,
  MAX_GAMES: 3,
};

/* ═══════════════════════════════════════════════════════════════════════════
   VALIDASI SET
   Return: 'A' | 'B' | null
   Set selesai kalau: skor >= 15 DAN selisih >= 2
   Tanpa cap — bisa 20-18, 30-28, dst.
   ═══════════════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════════════
   HITUNG HASIL DARI DAFTAR SET
   Input: [{ a, b }, ...]
   Output: { winner: 'A'|'B', scoreSet: '2-0', gamesA, gamesB, valid }
   ═══════════════════════════════════════════════════════════════════════════ */
export function computeMatchResult(sets) {
  if (!Array.isArray(sets) || sets.length < 2 || sets.length > RULES.MAX_GAMES) {
    return {
      winner: null,
      scoreSet: null,
      gamesA: 0,
      gamesB: 0,
      valid: false,
      reason: 'invalid-length',
    };
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
    if (w === 'A') gamesA++;
    else gamesB++;
  }

  /* Cek best of 3 — kalau ada yang capai 2, selesai */
  let winner = null;
  if (gamesA >= RULES.GAMES_TO_WIN) winner = 'A';
  else if (gamesB >= RULES.GAMES_TO_WIN) winner = 'B';

  /* Valid kalau pemenang sudah ditentukan */
  const valid = winner !== null;

  return {
    winner,
    scoreSet: `${gamesA}-${gamesB}`,
    gamesA,
    gamesB,
    valid,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   VALIDASI KATEGORI
   ═══════════════════════════════════════════════════════════════════════════ */
/* Terima array sets langsung ATAU objek kategori */
export function computeCategoryResult(input) {
  const sets = Array.isArray(input) ? input : (input && input.sets);
  return computeMatchResult(sets);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HITUNG SKOR KONTINGEN
   Input: [{ winner: 'A'|'B'|null, ... }, ...]
   Output: { scoreA, scoreB, decided, total }
   ═══════════════════════════════════════════════════════════════════════════ */
export function computeScore(categories) {
  let scoreA = 0, scoreB = 0, decided = 0;
  (categories || []).forEach(c => {
    if (c.winner === 'A') { scoreA++; decided++; }
    else if (c.winner === 'B') { scoreB++; decided++; }
  });
  return { scoreA, scoreB, decided, total: (categories || []).length };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CEK BISA SELESAI
   ═══════════════════════════════════════════════════════════════════════════ */
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
   HITUNG KLASEMEN POOL
   Input: array match (dari SCHEDULE) + state
   Output: array tim dengan { name, main, menang, kalah, wo, poin, partaiMenang, partaiKalah }
   ═══════════════════════════════════════════════════════════════════════════ */
export function computeStandings(poolTeams, allMatches) {
  const stats = {};

  (poolTeams || []).forEach(team => {
    stats[team] = {
      name: team,
      main: 0,
      menang: 0,
      kalah: 0,
      wo: 0,
      poin: 0,
      partaiMenang: 0,
      partaiKalah: 0,
    };
  });

  (allMatches || []).forEach(match => {
    if (!match || typeof match !== 'object') return;

    const teamA = String(match.teamA || '').trim();
    const teamB = String(match.teamB || '').trim();
    if (!teamA || !teamB || !stats[teamA] || !stats[teamB]) return;

    const winnerName = match.winner === 'A' ? teamA : match.winner === 'B' ? teamB : null;
    if (!winnerName) return;

    const loserName = winnerName === teamA ? teamB : teamA;
    const winner = stats[winnerName];
    const loser = stats[loserName];
    const scoreA = Number(match.scoreA || 0);
    const scoreB = Number(match.scoreB || 0);
    const winnerScore = match.winner === 'A' ? scoreA : scoreB;
    const loserScore = match.winner === 'A' ? scoreB : scoreA;

    winner.main += 1;
    winner.menang += 1;
    winner.poin += 2;
    winner.partaiMenang += winnerScore;
    winner.partaiKalah += loserScore;

    loser.main += 1;
    loser.kalah += 1;
    loser.poin += 1;
    loser.partaiMenang += loserScore;
    loser.partaiKalah += winnerScore;

    if (match.wo === true || match.walkover === true) {
      winner.wo += 1;
    }
  });

  const ordered = Object.values(stats).sort((a, b) => {
    if (b.poin !== a.poin) return b.poin - a.poin;
    const diffA = a.partaiMenang - a.partaiKalah;
    const diffB = b.partaiMenang - b.partaiKalah;
    if (diffB !== diffA) return diffB - diffA;
    if (b.partaiMenang !== a.partaiMenang) return b.partaiMenang - a.partaiMenang;
    return a.name.localeCompare(b.name);
  });

  return Object.fromEntries(ordered.map(team => [team.name, team]));
}
