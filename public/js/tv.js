/* ═══════════════════════════════════════════════════════════════════════════
   TV MEJA — auto-scroll loop seamless
   ═══════════════════════════════════════════════════════════════════════════ */
import { getTable, getState, subscribe } from './state.js';
import { MATCH_BY_ID, KORSA_ON_DARK } from './config.js';
import { esc, plateHTML, clockText } from './util.js';

/* ═══════════════════════════════════════════════════════════════════════════
   STATE MODULE
   ═══════════════════════════════════════════════════════════════════════════ */

let assignedMeja = null;
let clockTimer = null;
let scrollRAF = null;
let scrollPauseUntil = 0;
let lastVersion = -1;

const SCROLL_SPEED = 0.5;      // pixel per frame (~30px/detik @60fps)
const LOOP_PAUSE_MS = 2000;    // pause di akhir sebelum loop
const UPDATE_PAUSE_MS = 4000;  // pause setelah update state nyata

/* ═══════════════════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════════════════ */

export function initTV(meja) {
  if (![1, 2, 3, 4].includes(meja)) return;
  assignedMeja = meja;

  startClock();
  renderTV();

  lastVersion = getState()?.version ?? -1;

  subscribe(() => {
    const s = getState();
    const version = s?.version ?? 0;
    if (version === lastVersion) return;
    lastVersion = version;
    renderTV();
    scrollPauseUntil = Date.now() + UPDATE_PAUSE_MS;
  });

  window.addEventListener('resize', () => renderTV());

  /* ── Fullscreen ─────────────────────────────────────────────────── */
  const btnEnter = document.getElementById('tv-btn-fullscreen');
  const btnExit  = document.getElementById('tv-btn-exit-fullscreen');

  btnEnter?.addEventListener('click', () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  });
  btnExit?.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  /* Update tombol saat status fullscreen berubah */
  document.addEventListener('fullscreenchange', () => {
    const isFs = !!document.fullscreenElement;
    if (btnEnter) btnEnter.hidden = isFs;
    if (btnExit)  btnExit.hidden  = !isFs;
    /* Re-render layout supaya ukuran menyesuaikan */
    requestAnimationFrame(() => renderTV());
  });

  /* Tombol F untuk toggle fullscreen */
  document.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      } else {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    }
  });
}

function startClock() {
  if (clockTimer) clearInterval(clockTimer);
  const tick = () => {
    const el = document.getElementById('tv-clock');
    if (el) el.textContent = clockText();
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER
   ═══════════════════════════════════════════════════════════════════════════ */

function renderTV() {
  const t = getTable(assignedMeja);
  if (!t) return;
  const card = document.getElementById('card');
  if (!card) return;

  const fixture = t.match ? MATCH_BY_ID[t.match] : null;
  const decided = t.categories.filter(c => c.winner);

  card.dataset.status = t.status;

  card.innerHTML = `
    <header class="tv-head">
      <div class="tv-head__left">
        <img class="tv-head__logo" src="${esc(KORSA_ON_DARK)}" alt="">
        <div class="tv-head__title">
          <span class="tv-head__meja">LAPANGAN ${esc(t.id)}</span>
          ${t.match ? `<span class="tv-head__code">${esc(t.match)}</span>` : ''}
        </div>
      </div>
      <div class="tv-head__mid">
        ${fixture ? `<span class="tv-head__phase">${esc(fixture.phase)}</span>` : ''}
      </div>
      <div class="tv-head__right">
        ${statusBadge(t.status)}
        <span class="tv-head__clock u-num" id="tv-clock">${clockText()}</span>
      </div>
    </header>

    ${matchupHTML(t)}

    ${decided.length === 0
      ? emptyHTML()
      : `
        <div class="tv-summary">
          <b>${decided.length}</b> dari <b>${t.categories.length}</b> kategori dimainkan
        </div>
        <div class="tv-scroll" id="tv-scroll">
          <div class="tv-scroll__inner" id="tv-scroll-inner">
            ${decided.map(cat => catCardHTML(t, cat)).join('')}
          </div>
        </div>
      `
    }
  `;

  startClock();
  requestAnimationFrame(() => setupAutoScroll());
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUTO-SCROLL
   ═══════════════════════════════════════════════════════════════════════════ */

function setupAutoScroll() {
  /* Cancel RAF lama */
  if (scrollRAF) {
    cancelAnimationFrame(scrollRAF);
    scrollRAF = null;
  }

  const viewport = document.getElementById('tv-scroll');
  const inner = document.getElementById('tv-scroll-inner');
  if (!viewport || !inner) return;

  const originalHTML = inner.innerHTML;
  const originalCount = inner.children.length;

  /* Duplikat konten biar loop seamless */
  inner.innerHTML = originalHTML + originalHTML;

  /* Tunggu layout settle sebelum ukur */
  requestAnimationFrame(() => {
    const children = Array.from(inner.children);
    const firstCycle = children.slice(0, originalCount);

    /* Hitung tinggi satu putaran */
    const contentHeight = firstCycle.reduce((sum, el) => {
      const style = getComputedStyle(el);
      const mt = parseFloat(style.marginTop) || 0;
      const mb = parseFloat(style.marginBottom) || 0;
      return sum + el.offsetHeight + mt + mb;
    }, 0);

    const viewportHeight = viewport.clientHeight;

    /* Kalau konten muat, tidak perlu scroll */
    if (contentHeight <= viewportHeight + 4) {
      inner.innerHTML = originalHTML;
      return;
    }

    startScrollLoop(viewport, contentHeight);
  });
}

function startScrollLoop(viewport, contentHeight) {
  let lastTs = performance.now();
  let logCounter = 0;

  /* Delay awal sebelum mulai scroll */
  scrollPauseUntil = Date.now() + 1500;

  function step(ts) {
    const dt = Math.min(64, ts - lastTs);
    lastTs = ts;

    /* Debug log tiap ~1 detik */
    logCounter++;
    if (logCounter % 60 === 0) {
      console.log('[TV] scrollTop:', Math.round(viewport.scrollTop),
                  '/ contentHeight:', contentHeight,
                  '/ pauseLeft:',
                  Math.max(0, Math.round((scrollPauseUntil - Date.now()) / 1000)) + 's');
    }

    /* Skip gerakan kalau sedang jeda */
    if (Date.now() < scrollPauseUntil) {
      scrollRAF = requestAnimationFrame(step);
      return;
    }

    const delta = SCROLL_SPEED * (dt / 16.67);
    const nextTop = viewport.scrollTop + delta;

    /* Loop mulus: scrollTop geser sebesar contentHeight tanpa animasi */
    if (nextTop >= contentHeight) {
      viewport.scrollTop = nextTop - contentHeight;
      scrollPauseUntil = Date.now() + LOOP_PAUSE_MS;
    } else {
      viewport.scrollTop = nextTop;
    }

    scrollRAF = requestAnimationFrame(step);
  }

  scrollRAF = requestAnimationFrame(step);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER
   ═══════════════════════════════════════════════════════════════════════════ */

function statusBadge(status) {
  const label = { waiting: 'MENUNGGU', live: '● LIVE', finished: 'SELESAI' }[status] || '';
  return `<span class="tv-status tv-status--${status}">${label}</span>`;
}

function matchupHTML(t) {
  return `
    <div class="tv-matchup">
      <div class="tv-matchup__team tv-matchup__team--a">
        ${plateHTML(t.teamA, 'tv-matchup__logo')}
        <span class="tv-matchup__name">${esc(t.teamA)}</span>
      </div>

      <div class="tv-matchup__score u-num">
        ${esc(t.scoreA)} <i>—</i> ${esc(t.scoreB)}
      </div>

      <div class="tv-matchup__team tv-matchup__team--b">
        ${plateHTML(t.teamB, 'tv-matchup__logo')}
        <span class="tv-matchup__name">${esc(t.teamB)}</span>
      </div>
    </div>
  `;
}

function catCardHTML(t, cat) {
  const idx = t.categories.indexOf(cat);
  const winnerName = cat.winner === 'A' ? t.teamA : t.teamB;
  const sets = cat.sets || [];

  const setsHTML = sets.map((s, i) =>
    `<span class="tv-cat__set">
       <i>Set ${i + 1}</i>
       <b>${s.a}-${s.b}</b>
     </span>`
  ).join('');

  return `
    <div class="tv-cat" data-winner="${cat.winner}">
      <div class="tv-cat__num">${idx + 1}</div>

      <div class="tv-cat__body">
        <div class="tv-cat__name">${esc(cat.name)}</div>

        <div class="tv-cat__result">
          <div class="tv-cat__winner">
            ${plateHTML(winnerName, 'tv-cat__plate')}
            <span class="tv-cat__winner-name">${esc(winnerName)}</span>
          </div>
          <div class="tv-cat__rally">${setsHTML}</div>
        </div>
      </div>

      <div class="tv-cat__score">${esc(cat.scoreSet)}</div>
    </div>
  `;
}

function emptyHTML() {
  return `
    <div class="tv-empty">
      <img src="assets/logos/korsa-on-dark.png" alt="" class="tv-empty__logo">
      <div class="tv-empty__text">Menunggu Pertandingan</div>
    </div>
  `;
}
