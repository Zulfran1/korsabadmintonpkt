/* ═══════════════════════════════════════════════════════════════════════════
   DISPLAY — videotron
   KORSA 2026 Bulu Tangkis
   ═══════════════════════════════════════════════════════════════════════════ */
import {
  getState, subscribe,
  toggleVtMode, toggleRatio,
} from './state.js';
import { MATCH_BY_ID, EVENT, KORSA_ON_LIGHT, KORSA_ON_DARK } from './config.js';
import { esc, plateHTML, pillHTML, clockText, fitAll, toast } from './util.js';

let renderFrame = 0;

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER
   ═══════════════════════════════════════════════════════════════════════════ */

export function renderDisplay() {
  if (renderFrame) {
    cancelAnimationFrame(renderFrame);
    renderFrame = 0;
  }
  const grid = document.getElementById('vt-grid');
  if (!grid) return;

  const state = getState();
  const visible = state.tables.filter(t => t.id <= state.activeMeja && !t.hidden);
  const matches = groupTablesForDisplay(visible);

  grid.dataset.layout = String(matches.length || 1);
  grid.innerHTML = matches.map(cellHTML).join('');

  requestAnimationFrame(() => {
    fitAll(grid, '.row__name', 12);
    fitAll(grid, '.cell__wait-team span', 12);
    fitAll(grid, '.cell__result-name', 12);
  });
}

function scheduleDisplayRender() {
  if (document.hidden) return;
  if (renderFrame) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0;
    renderDisplay();
  });
}

/* Satu pertandingan dapat memakai dua lapangan. Videotron menggabungkannya
   menjadi satu panel dan tetap menampilkan nomor kedua lapangan. */
export function groupTablesForDisplay(tables, fixtures = MATCH_BY_ID) {
  const groups = new Map();

  for (const table of tables || []) {
    const key = table.match ? `match:${table.match}` : `table:${table.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(table);
  }

  return [...groups.values()].map(group => {
    const base = group[0];
    if (!base?.match) return { ...base, courtIds: [base.id] };

    const fixture = fixtures[base.match] || null;
    const maxCategories = Math.max(...group.map(table => table.categories?.length || 0), 0);
    const categories = Array.from({ length: maxCategories }, (_, index) => {
      const candidates = group.map(table => table.categories?.[index]).filter(Boolean);
      const decided = candidates.find(category => category.winner);
      return structuredClone(decided || candidates[0]);
    }).filter(Boolean);
    const scoreA = categories.filter(category => category.winner === 'A').length;
    const scoreB = categories.filter(category => category.winner === 'B').length;
    const anyLive = group.some(table => table.status === 'live');
    const allFinished = group.every(table => table.status === 'finished');
    const hasResult = categories.some(category => category.winner);
    const status = allFinished ? 'finished' : (anyLive || hasResult ? 'live' : 'waiting');

    return {
      ...base,
      courtIds: fixture?.mejas || group.map(table => table.id).sort((a, b) => a - b),
      categories,
      scoreA,
      scoreB,
      status,
      winner: status === 'finished' ? (scoreA > scoreB ? 'A' : 'B') : null,
    };
  });
}

function cellHTML(t) {
  const fixture = t.match ? MATCH_BY_ID[t.match] : null;
  const courtIds = t.courtIds || [t.id];

  let body;
  if (t.status === 'waiting')      body = bodyWaiting(t, fixture);
  else if (t.status === 'finished') body = bodyFinished(t);
  else                              body = bodyLive(t);

  return `
    <div class="cell" data-status="${esc(t.status)}">
      <div class="cell__head">
        <span class="cell__table">LAPANGAN ${esc(courtIds.join(' & '))}</span>
        ${fixture ? `<span class="cell__phase">${esc(fixture.phase)}</span>` : ''}
        ${pillHTML(t.status)}
      </div>
      ${body}
    </div>
  `;
}

function bodyWaiting(t, fixture) {
  if (fixture) {
    return `
      <div class="cell__wait">
        <div class="cell__wait-label">Akan datang</div>
        <div class="cell__wait-fixture">
          <div class="cell__wait-team">
            ${plateHTML(t.teamA, '', 'eager')}
            <span>${esc(t.teamA)}</span>
          </div>
          <div class="cell__wait-vs">VS</div>
          <div class="cell__wait-team">
            ${plateHTML(t.teamB, '', 'eager')}
            <span>${esc(t.teamB)}</span>
          </div>
        </div>
        <div class="cell__wait-time u-num">${esc(fixture.time)} WITA</div>
      </div>
    `;
  }
  return `
    <div class="cell__wait">
      <img class="cell__wait-brand" src="${esc(korsaMark())}" alt="">
      <div class="cell__wait-label">Menunggu Pertandingan</div>
    </div>
  `;
}

function bodyLive(t) {
  const totalCats = t.categories.length;
  const decided  = t.categories.filter(c => c.winner).length;

  const row = (name, score, leading) => `
    <div class="row${leading ? ' row--leading' : ''}">
      ${plateHTML(name, 'row__logo', 'eager')}
      <div class="row__team">
        <div class="row__name">${esc(name)}</div>
      </div>
      <div class="row__score u-num">${esc(score)}</div>
    </div>
  `;

  return `
    <div class="cell__match">
      ${row(t.teamA, t.scoreA, t.scoreA > t.scoreB)}
      ${row(t.teamB, t.scoreB, t.scoreB > t.scoreA)}
    </div>
    <div class="cell__cats">
      <b>${decided}</b> dari <b>${totalCats}</b> kategori
    </div>
  `;
}

function bodyFinished(t) {
  const a = t.scoreA, b = t.scoreB;
  const tied = a === b;
  const winnerIsA = a > b;
  const winner = winnerIsA ? t.teamA : t.teamB;
  const loser  = winnerIsA ? t.teamB : t.teamA;

  const winnerBlock = tied
    ? `<div class="cell__result-name">Hasil imbang</div>`
    : `
      <div class="cell__result-winner">
        ${plateHTML(winner, 'cell__result-logo', 'eager')}
        <div class="cell__result-name">${esc(winner)}</div>
      </div>
    `;

  return `
    <div class="cell__result">
      <div class="cell__result-label">${tied ? 'Pertandingan selesai' : 'Pemenang'}</div>
      ${winnerBlock}
      <div class="cell__result-score u-num">
        <span class="${winnerIsA && !tied ? 'is-winner' : ''}">${esc(a)}</span>
        <i>:</i>
        <span class="${!winnerIsA && !tied ? 'is-winner' : ''}">${esc(b)}</span>
      </div>
      ${!tied ? `<div class="cell__result-opponent">Mengalahkan ${esc(loser)}</div>` : ''}
    </div>
  `;
}

function korsaMark() {
  const state = getState();
  return state.vtMode === 'light' ? KORSA_ON_LIGHT : KORSA_ON_DARK;
}

/* ═══════════════════════════════════════════════════════════════════════════
   HEADER & FOOTER
   ═══════════════════════════════════════════════════════════════════════════ */

export function renderHeader() {
  const el = document.querySelector('.vt__event');
  if (el) el.innerHTML = `${esc(EVENT.name)} <em>·</em> ${esc(EVENT.edition)}`;

  const logo = document.getElementById('vt-logo');
  if (logo) logo.src = KORSA_ON_DARK;

  const foot = document.querySelector('.vt__foot');
  if (foot) {
    foot.innerHTML =
      `<span>${esc(EVENT.venue)}</span><i>◆</i>` +
      `<span>${esc(EVENT.organizer)}</span><i>◆</i>` +
      `<span>${esc(EVENT.dateRange)}</span>`;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   JAM
   ═══════════════════════════════════════════════════════════════════════════ */

export function startClock() {
  const el = document.getElementById('vt-clock');
  if (!el) return;
  const tick = () => { el.textContent = clockText(); };
  tick();
  setInterval(tick, 1000);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODE & RASIO
   ═══════════════════════════════════════════════════════════════════════════ */

export function syncVtMode() {
  const mode = getState().vtMode === 'light' ? 'light' : 'dark';
  const display = document.getElementById('display');
  if (display) display.dataset.vtMode = mode;
  const btn = document.getElementById('btn-vtmode');
  if (btn) btn.textContent = (mode === 'dark') ? '☀ Mode Terang' : '☾ Mode Gelap';
}

export function syncRatio() {
  const ratio = getState().ratio;
  const vt = document.getElementById('vt');
  if (vt) vt.dataset.ratio = ratio;
  const btn = document.getElementById('btn-ratio');
  if (btn) btn.textContent = (ratio === 'fill') ? '1:1' : 'Isi layar';
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════════════════
   OPEN / CLOSE
   ═══════════════════════════════════════════════════════════════════════════ */

export function openDisplay() {
  const app = document.getElementById('app');
  if (app) app.style.display = 'none';
  const d = document.getElementById('display');
  if (d) d.dataset.open = 'true';
  renderDisplay();
}

export function closeDisplay() {
  const d = document.getElementById('display');
  if (d) d.dataset.open = 'false';
  const app = document.getElementById('app');
  if (app) app.style.display = '';
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════════════════ */

export function initDisplay() {
  renderHeader();
  startClock();
  syncVtMode();
  syncRatio();
  renderDisplay();

  /* Subscribe ke perubahan state — setiap kali server kirim state baru, re-render */
  subscribe(() => {
    syncVtMode();
    syncRatio();
    scheduleDisplayRender();
  }, { immediate: false });

  /* Tombol kontrol */
  document.getElementById('btn-vtmode')?.addEventListener('click', async () => {
    try {
      await toggleVtMode();
    } catch (e) {
      toast('Gagal ganti mode: ' + e.message, 'error');
    }
  });

  document.getElementById('btn-ratio')?.addEventListener('click', async () => {
    try {
      await toggleRatio();
    } catch (e) {
      toast('Gagal ganti rasio: ' + e.message, 'error');
    }
  });

  document.getElementById('btn-fullscreen')?.addEventListener('click', toggleFullscreen);
  document.getElementById('btn-close')?.addEventListener('click', closeDisplay);

  /* Escape untuk tutup (kalau bukan fullscreen) */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.fullscreenElement) closeDisplay();
  });

  /* Resize → re-fit text */
  window.addEventListener('resize', scheduleDisplayRender);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleDisplayRender();
  });
}
