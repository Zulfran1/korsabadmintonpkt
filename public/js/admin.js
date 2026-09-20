/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN — navigation hub dengan sidebar
   KORSA 2026 Bulu Tangkis
   ═══════════════════════════════════════════════════════════════════════════ */
import {
  getState, getTable, subscribe,
  setActiveMeja, setTeam, setStatus, toggleTableDisplay, resetTable, resetAll,
  loadMatch, isTableBusy,
  addCategory, removeCategory, renameCategory, moveCategory, resetCategories,
  finishMatch, reopenMatch, canFinish,
  setVtMode, setRatio,
} from './state.js';
import { MATCH_BY_ID, SCHEDULE, LOGOS, EVENT, KORSA_ON_LIGHT } from './config.js';
import {
  esc, plateHTML, pillHTML, clockText,
  toast, confirmAsk, debounce,
} from './util.js';
import { computeStandings, countFinishedMatches } from './standings.js';
import { bindAdminSidebar } from './admin-sidebar.js';

/* ═══════════════════════════════════════════════════════════════════════════
   STATE LOKAL UI
   ═══════════════════════════════════════════════════════════════════════════ */

let openEditorMeja = null;
let openPopSide = null;
let activeTab = 'meja';
let clockStarted = false;

const TABS = [
  { id: 'meja',       label: 'Lapangan',   icon: '🏓' },
  { id: 'klasemen',   label: 'Klasemen',   icon: '🏆' },
  { id: 'jadwal',     label: 'Jadwal',     icon: '📅' },
  { id: 'display',    label: 'Display',    icon: '📺' },
  { id: 'tv',         label: 'TV',         icon: '🖥' },
  { id: 'pengaturan', label: 'Pengaturan', icon: '⚙' },
];
const TAB_IDS = TABS.map(t => t.id);

/* ═══════════════════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════════════════ */

export function initAdmin() {
  bindAdminSidebar();
  renderAll();
  startClock();

  subscribe(() => renderAll());

  /* Klik global */
  document.addEventListener('click', e => {
    const layout = document.getElementById('admin-layout');
    /* Sidebar nav */
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      switchAdminTab(tab.dataset.tab);
      if (layout && window.matchMedia('(max-width: 1080px)').matches) {
        layout.dataset.sidebar = 'closed';
      }
      return;
    }
    /* Team popup auto-close */
    if (!e.target.closest('.side__pick')) closeTeamPop();
  });

  /* Escape */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (openPopSide) { closeTeamPop(); return; }
    if (openEditorMeja !== null) { closeCategoryEditor(); return; }
  });
}

function startClock() {
  if (clockStarted) return;
  clockStarted = true;
  const el = document.getElementById('clock');
  if (!el) return;
  const tick = () => { el.textContent = clockText(); };
  tick();
  setInterval(tick, 1000);
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB SWITCHING
   ═══════════════════════════════════════════════════════════════════════════ */

function switchAdminTab(name) {
  if (!TAB_IDS.includes(name)) return;
  if (name === activeTab) return;
  activeTab = name;
  renderAll();
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER ALL
   ═══════════════════════════════════════════════════════════════════════════ */

function renderAll() {
  renderTableCount();
  renderSidebar();

  /* Sembunyikan semua konten tab */
  const allIds = ['board', 'standings-content', 'schedule-content', 'display-content', 'tv-content', 'settings-content'];
  allIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });

  /* Tampilkan tab aktif */
  switch (activeTab) {
    case 'meja': {
      const el = document.getElementById('board');
      if (el) { el.hidden = false; renderBoard(); }
      break;
    }
    case 'klasemen': {
      const el = document.getElementById('standings-content');
      if (el) { el.hidden = false; renderStandings(); }
      break;
    }
    case 'jadwal': {
      const el = document.getElementById('schedule-content');
      if (el) { el.hidden = false; renderJadwalTab(); }
      break;
    }
    case 'display': {
      const el = document.getElementById('display-content');
      if (el) { el.hidden = false; renderDisplayTab(); }
      break;
    }
    case 'tv': {
      const el = document.getElementById('tv-content');
      if (el) { el.hidden = false; renderTVTab(); }
      break;
    }
    case 'pengaturan': {
      const el = document.getElementById('settings-content');
      if (el) { el.hidden = false; renderSettingsTab(); }
      break;
    }
  }

  renderSchedule();
  renderScheduleCount();
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════════════════ */

function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  if (nav) {
    nav.innerHTML = TABS.map(t => `
      <button class="sidebar__item${activeTab === t.id ? ' is-active' : ''}"
              data-tab="${t.id}" type="button">
        <span class="sidebar__icon" aria-hidden="true">${t.icon}</span>
        <span class="sidebar__label">${t.label}</span>
      </button>
    `).join('');
  }

  const title = document.getElementById('admin-tab-title');
  const current = TABS.find(t => t.id === activeTab);
  if (title && current) title.textContent = current.label;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB: MEJA
   ═══════════════════════════════════════════════════════════════════════════ */

function renderTableCount() {
  const el = document.getElementById('table-count');
  if (!el) return;
  const active = getState().activeMeja;
  el.innerHTML = [1, 2, 3, 4].map(n => `
    <button class="segmented__item" aria-pressed="${n === active}"
            data-role="set-active" data-n="${n}" type="button">${n}</button>
  `).join('');
}

function renderBoard() {
  const board = document.getElementById('board');
  if (!board) return;
  const state = getState();
  board.dataset.count = String(state.activeMeja);
  const visible = state.tables.filter(t => t.id <= state.activeMeja);
  board.innerHTML = visible.map(adminCardHTML).join('');
}

function adminCardHTML(t) {
  const fixture = t.match ? MATCH_BY_ID[t.match] : null;
  const editorOpen = openEditorMeja === t.id;

  return `
    <section class="match" data-status="${esc(t.status)}" data-meja="${t.id}">
      <header class="match__head">
        <span class="match__table">LAPANGAN ${esc(t.id)}</span>
        ${t.match ? `<span class="match__code">${esc(t.match)}</span>` : ''}
        ${fixture ? `<span class="match__phase">${esc(fixture.phase)}</span>` : ''}
        ${pillHTML(t.status)}
      </header>

      <div class="match__body">
        ${sideHTML(t, 'A')}
        ${sideHTML(t, 'B')}
      </div>

      ${catSummaryHTML(t)}
      ${editorOpen ? categoryEditorHTML(t) : categoryListCompactHTML(t)}
      ${t.status === 'finished' ? winnerHTML(t) : ''}

      <footer class="match__foot">
        <div class="segmented segmented--status" role="group">
          ${statusBtn(t, 'waiting')}${statusBtn(t, 'live')}${statusBtn(t, 'finished')}
        </div>
        ${t.status === 'finished'
          ? `<button class="btn btn--outline" data-role="reopen" data-meja="${t.id}" type="button">Buka kembali</button>`
          : `<button class="btn btn--success" data-role="finish" data-meja="${t.id}" type="button"
                ${canFinish(t).ok ? '' : 'disabled'}>Selesaikan</button>`}
        <button class="btn btn--quiet" data-role="edit-cats" data-meja="${t.id}" type="button">
          ${editorOpen ? 'Selesai Atur' : 'Atur Kategori'}
        </button>
        <button class="btn btn--quiet" data-role="open-controller" data-meja="${t.id}" type="button">
          Buka Controller
        </button>
        <button class="btn btn--quiet btn--display-close" data-role="toggle-display" data-meja="${t.id}" type="button">
          ${t.hidden ? 'Tampilkan' : 'Sembunyikan'}
        </button>
        <button class="btn btn--quiet btn--danger-quiet" data-role="reset-table" data-meja="${t.id}" type="button">
          Nol-kan
        </button>
      </footer>
    </section>
  `;
}

function sideHTML(t, side) {
  const name  = side === 'A' ? t.teamA : t.teamB;
  const score = side === 'A' ? t.scoreA : t.scoreB;
  const other = side === 'A' ? t.scoreB : t.scoreA;
  const leading = score > other;
  const popOpen = openPopSide && openPopSide.meja === t.id && openPopSide.side === side;

  return `
    <div class="side${leading ? ' side--leading' : ''}" data-side="${side}">
      ${plateHTML(name, 'side__logo')}
      <div class="side__pick">
        <input class="side__name" type="text" value="${esc(name)}"
               maxlength="24" list="team-names"
               data-meja="${t.id}" data-side="${side}" data-role="team-input">
        <button class="side__pickbtn" type="button"
                aria-expanded="${!!popOpen}"
                data-meja="${t.id}" data-side="${side}" data-role="team-popbtn">
          <svg class="pick__chev" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor"
                  stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        ${popOpen ? teamPopHTML(t.id, side) : ''}
      </div>
      <div class="side__score u-num">${esc(score)}</div>
    </div>
  `;
}

function teamPopHTML(meja, side) {
  return `
    <div class="teampop">
      ${Object.keys(LOGOS).map(name => `
        <button class="teampop__item" type="button"
                data-meja="${meja}" data-side="${side}"
                data-team="${esc(name)}" data-role="team-pick">
          ${plateHTML(name, '')}
          <span>${esc(name)}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function catSummaryHTML(t) {
  const total = t.categories.length;
  const decided = t.categories.filter(c => c.winner).length;
  const complete = decided === total && total > 0;
  return `
    <div class="catsummary">
      <span class="catsummary__pill${complete ? ' is-complete' : ''}">
        <b>${decided}</b> dari <b>${total}</b> kategori
      </span>
    </div>
  `;
}

function categoryListCompactHTML(t) {
  if (!t.categories.length) return '';
  const rows = t.categories.map((c, i) => {
    const winnerName = c.winner === 'A' ? t.teamA : (c.winner === 'B' ? t.teamB : '');
    const rallyText = (c.sets || []).map(s => `${s.a}-${s.b}`).join(' · ');
    return `
      <li class="cat-item" data-winner="${c.winner || ''}" data-pending="${!c.winner}">
        <span class="cat-item__num">${i + 1}</span>
        <span class="cat-item__name">${esc(c.name)}</span>
        <span class="cat-item__sets u-num">${esc(c.scoreSet || '—')}</span>
        <span class="cat-item__winner">${esc(winnerName || '—')}</span>
        <span class="cat-item__actions"></span>
        ${rallyText ? `<div class="cat-item__rally u-num">${esc(rallyText)}</div>` : ''}
      </li>
    `;
  }).join('');
  return `<ul class="cat-list">${rows}</ul>`;
}

function categoryEditorHTML(t) {
  const rows = t.categories.map((c, i) => {
    const locked = !!c.winner;
    return `
      <div class="cat-row" data-index="${i}" data-locked="${locked}">
        <span class="cat-row__handle" title="Urutan">⋮⋮</span>
        <input type="text" value="${esc(c.name)}" maxlength="40"
               ${locked ? 'disabled' : ''}
               data-meja="${t.id}" data-index="${i}" data-role="cat-name"
               aria-label="Nama kategori ${i + 1}">
        <button class="cat-row__btn" type="button"
                data-meja="${t.id}" data-index="${i}" data-dir="-1" data-role="cat-move"
                ${i === 0 ? 'disabled' : ''} aria-label="Naikkan">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M6 3v6M3 6l3-3 3 3" fill="none" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="cat-row__btn" type="button"
                data-meja="${t.id}" data-index="${i}" data-dir="1" data-role="cat-move"
                ${i === t.categories.length - 1 ? 'disabled' : ''} aria-label="Turunkan">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M6 9V3M3 6l3 3 3-3" fill="none" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="cat-row__btn cat-row__btn--danger" type="button"
                data-meja="${t.id}" data-index="${i}" data-role="cat-remove"
                ${locked ? 'disabled' : ''} aria-label="Hapus kategori">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" fill="none" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  return `
    <div class="cat-editor">
      <div class="cat-editor__head"><span>Atur Kategori</span></div>
      ${rows}
      <div class="cat-editor__foot">
        <button class="btn btn--quiet" type="button" data-meja="${t.id}" data-role="cat-add">
          + Tambah Kategori
        </button>
        <button class="btn btn--quiet" type="button" data-meja="${t.id}" data-role="cat-reset">
          Reset ke Default
        </button>
      </div>
    </div>
  `;
}

function winnerHTML(t) {
  const winnerName = t.winner === 'A' ? t.teamA : t.teamB;
  const loserName  = t.winner === 'A' ? t.teamB : t.teamA;
  return `
    <div class="match__winner">
      ${plateHTML(winnerName, '')}
      <span>Pemenang: <b>${esc(winnerName)}</b> · ${esc(t.scoreA)}–${esc(t.scoreB)} vs ${esc(loserName)}</span>
    </div>
  `;
}

function statusBtn(t, s) {
  return `
    <button class="segmented__item" data-status="${s}"
            aria-pressed="${t.status === s}"
            data-meja="${t.id}" data-role="set-status" type="button">
      ${{ waiting: 'MENUNGGU', live: 'LIVE', finished: 'SELESAI' }[s]}
    </button>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB: KLASEMEN
   ═══════════════════════════════════════════════════════════════════════════ */

function renderStandings() {
  const el = document.getElementById('standings-content');
  if (!el) return;

  const standings = computeStandings();
  const { finished, total } = countFinishedMatches();

  el.innerHTML = `
    <div class="standings-info">
      <b>${finished}</b> dari <b>${total}</b> pertandingan penyisihan selesai
    </div>

    <div class="standings-grid">
      ${standingsTable('Pool A', standings.A)}
      ${standingsTable('Pool B', standings.B)}
    </div>

    <div class="standings-legend">
      <b>M</b> = Main · <b>W</b> = Menang · <b>L</b> = Kalah ·
      <b>PM</b> = Partai Menang · <b>PK</b> = Partai Kalah ·
      Poin: Menang <b>2</b>, Kalah <b>1</b>, WO <b>0</b>
    </div>
  `;
}

function standingsTable(title, rows) {
  return `
    <div class="standings-card">
      <div class="standings-card__head">${esc(title)}</div>
      <table class="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Tim</th>
            <th class="num">M</th>
            <th class="num">W</th>
            <th class="num">L</th>
            <th class="num">PM</th>
            <th class="num">PK</th>
            <th class="num">Poin</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr class="${i === 0 ? 'is-leader' : ''}">
              <td class="num">${i + 1}</td>
              <td class="name">
                ${plateHTML(r.name, 'standings-logo')}
                <span>${esc(r.name)}</span>
              </td>
              <td class="num">${r.main}</td>
              <td class="num">${r.menang}</td>
              <td class="num">${r.kalah}</td>
              <td class="num">${r.partaiMenang}</td>
              <td class="num">${r.partaiKalah}</td>
              <td class="num poin"><b>${r.poin}</b></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB: JADWAL
   ═══════════════════════════════════════════════════════════════════════════ */

function renderJadwalTab() {
  const el = document.getElementById('schedule-content');
  if (!el) return;
  const state = getState();

  const byDate = {};
  SCHEDULE.forEach(m => {
    if (!byDate[m.date]) byDate[m.date] = { day: m.day, matches: [] };
    byDate[m.date].matches.push(m);
  });

  el.innerHTML = `
    <div class="jadwal-list">
      ${Object.entries(byDate).map(([date, group]) => `
        <div class="jadwal-day">
          <div class="jadwal-day__head">
            <span class="jadwal-day__date">${esc(group.day)}, ${esc(date)}</span>
          </div>
          <div class="jadwal-matches">
            ${group.matches.map(m => jadwalMatchHTML(m, state)).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function jadwalMatchHTML(m, state) {
  const result = state.results?.[m.id] || null;
  const expectedIds = m.mejas || [m.meja];
  const tables = state.tables.filter(x => x.match === m.id);
  const t = tables[0] || null;
  const mejaIds = expectedIds;
  const status = result ? 'finished' : (t?.status || 'waiting');
  const hasResult = !!result || !!t?.categories.some(c => c.winner);
  const loaded = !!result || expectedIds.every(id => tables.some(table => table.id === id));

  return `
    <div class="jadwal-match" data-status="${status}" data-loaded="${loaded}">
      <div class="jadwal-match__code">${esc(m.id)}</div>
      <div class="jadwal-match__teams">
        <span>${esc(m.teamA)}</span>
        <i>vs</i>
        <span>${esc(m.teamB)}</span>
      </div>
      <div class="jadwal-match__info">
        <span class="jadwal-match__phase">${esc(m.phase)}</span>
        <span class="jadwal-match__time u-num">${esc(m.time)} WITA</span>
        <span class="jadwal-match__meja">L${mejaIds.join(' & L')}</span>
      </div>
      <div class="jadwal-match__status">
        ${statusBadgeJadwal(status, hasResult)}
      </div>
      <div class="jadwal-match__actions">
        ${result
          ? `<span class="pill pill--finished">Hasil tersimpan</span>`
          : loaded
          ? mejaIds.map(id => `<button class="btn btn--quiet" data-role="open-controller" data-meja="${id}" type="button">Buka L${id}</button>`).join('')
          : `<button class="btn btn--quiet" data-role="load-match-from-jadwal" data-match="${esc(m.id)}" type="button">Muat ke ${mejaIds.map(id => `L${id}`).join(' & ')}</button>`}
      </div>
    </div>
  `;
}

function statusBadgeJadwal(status, hasResult) {
  if (status === 'finished') return `<span class="pill pill--finished"><span class="dot"></span>Selesai</span>`;
  if (status === 'live' || hasResult) return `<span class="pill pill--live"><span class="dot"></span>Live</span>`;
  return `<span class="pill pill--waiting"><span class="dot"></span>Belum</span>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB: DISPLAY
   ═══════════════════════════════════════════════════════════════════════════ */

function renderDisplayTab() {
  const el = document.getElementById('display-content');
  if (!el) return;
  const state = getState();

  el.innerHTML = `
    <div class="display-tab">
      <div class="display-tab__info">
        <div class="info-card">
          <div class="info-card__label">Mode Display</div>
          <div class="info-card__value">${state.vtMode === 'light' ? 'Terang' : 'Gelap'}</div>
        </div>
        <div class="info-card">
          <div class="info-card__label">Lapangan Aktif</div>
          <div class="info-card__value">${state.activeMeja}</div>
        </div>
        <div class="info-card">
          <div class="info-card__label">Ratio</div>
          <div class="info-card__value">${state.ratio === 'fill' ? 'Isi Layar' : '1:1'}</div>
        </div>
      </div>

      <div class="display-tab__actions">
        <button class="btn btn--accent" data-role="open-display-new" type="button">
          ◱ Buka Display (Window Baru)
        </button>
        <button class="btn btn--outline" data-role="open-tv-1" type="button">📺 TV Lapangan 1</button>
        <button class="btn btn--outline" data-role="open-tv-2" type="button">📺 TV Lapangan 2</button>
        <button class="btn btn--outline" data-role="open-tv-3" type="button">📺 TV Lapangan 3</button>
        <button class="btn btn--outline" data-role="open-tv-4" type="button">📺 TV Lapangan 4</button>
      </div>

      <div class="display-tab__preview">
        <div class="display-tab__preview-label">Preview Display</div>
        <iframe src="display.html" class="display-tab__iframe" title="Preview Display"></iframe>
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB: TV
   ═══════════════════════════════════════════════════════════════════════════ */

function renderTVTab() {
  const el = document.getElementById('tv-content');
  if (!el) return;
  const state = getState();

  el.innerHTML = `
    <div class="tv-grid">
      ${[1, 2, 3, 4].map(n => {
        const t = state.tables.find(x => x.id === n);
        const active = n <= state.activeMeja;
        return `
          <div class="tv-card-info${active ? '' : ' is-inactive'}">
            <div class="tv-card-info__head">
              <span class="tv-card-info__num">LAPANGAN ${n}</span>
              ${t && t.match ? `<span class="tv-card-info__code">${esc(t.match)}</span>` : ''}
            </div>
            <div class="tv-card-info__teams">
              ${t ? `
                <div class="tv-card-info__team">
                  ${plateHTML(t.teamA, 'tv-card-info__logo')}
                  <span>${esc(t.teamA)}</span>
                </div>
                <div class="tv-card-info__vs">VS</div>
                <div class="tv-card-info__team">
                  ${plateHTML(t.teamB, 'tv-card-info__logo')}
                  <span>${esc(t.teamB)}</span>
                </div>
              ` : ''}
            </div>
            <div class="tv-card-info__status">
              ${t ? pillHTML(t.status) : ''}
            </div>
            <button class="btn btn--primary tv-card-info__btn"
                    data-role="open-tv-${n}" type="button">
              Buka TV Lapangan ${n}
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB: PENGATURAN
   ═══════════════════════════════════════════════════════════════════════════ */

function renderSettingsTab() {
  const el = document.getElementById('settings-content');
  if (!el) return;
  const state = getState();

  el.innerHTML = `
    <div class="settings-sections">

      <div class="settings-card">
        <div class="settings-card__head">Mode Display</div>
        <div class="settings-card__body">
          <button class="btn ${state.vtMode === 'dark' ? 'btn--primary' : 'btn--outline'}"
                  data-role="set-vt-mode" data-mode="dark" type="button">Gelap</button>
          <button class="btn ${state.vtMode === 'light' ? 'btn--primary' : 'btn--outline'}"
                  data-role="set-vt-mode" data-mode="light" type="button">Terang</button>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-card__head">Ratio Display</div>
        <div class="settings-card__body">
          <button class="btn ${state.ratio === 'fill' ? 'btn--primary' : 'btn--outline'}"
                  data-role="set-ratio" data-ratio="fill" type="button">Isi Layar</button>
          <button class="btn ${state.ratio === 'square' ? 'btn--primary' : 'btn--outline'}"
                  data-role="set-ratio" data-ratio="square" type="button">1:1</button>
        </div>
      </div>

      <div class="settings-card settings-card--danger">
        <div class="settings-card__head">Reset</div>
        <div class="settings-card__body">
          <button class="btn btn--danger" data-role="reset-all" type="button">
            Reset Semua Data
          </button>
          <p class="settings-card__hint">Menghapus semua skor, status, dan jadwal yang dimuat.</p>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-card__head">Info Sistem</div>
        <div class="settings-card__body settings-card__body--info">
          <div class="info-row"><span>Event</span><b>${esc(EVENT.name)} · ${esc(EVENT.edition)}</b></div>
          <div class="info-row"><span>Venue</span><b>${esc(EVENT.venue)}</b></div>
          <div class="info-row"><span>Tanggal</span><b>${esc(EVENT.dateRange)}</b></div>
          <div class="info-row"><span>Kategori</span><b>7 partai</b></div>
          <div class="info-row"><span>Poin</span><b>15 · best of 3</b></div>
          <div class="info-row"><span>State Version</span><b>v${state.version}</b></div>
        </div>
      </div>

    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PANEL JADWAL (sidebar kanan)
   ═══════════════════════════════════════════════════════════════════════════ */

function renderSchedule() {
  const list = document.getElementById('schedule-list');
  if (!list) return;
  const state = getState();
  let html = '';
  let lastDate = '';
  SCHEDULE.forEach(m => {
    if (m.date !== lastDate) {
      lastDate = m.date;
      html += `
        <div class="schedule__day u-eyebrow">
          ${esc(m.day)}, ${esc(m.date)}
          <span class="schedule__phase u-eyebrow">${esc(m.phase)}</span>
        </div>
      `;
    }
    const expectedIds = m.mejas || [m.meja];
    const loaded = !!state.results?.[m.id] || expectedIds.every(id => state.tables.some(t => t.id === id && t.match === m.id));
    html += `
      <button class="slot" data-loaded="${loaded}"
              data-role="load-match" data-match="${esc(m.id)}"
              title="Muat ke lapangan ${(m.mejas || [m.meja]).join(' dan ')}" type="button">
        <span class="slot__code">${esc(m.id)}</span>
        <span>
          <span class="slot__teams">${esc(m.teamA)} <span class="slot__vs">vs</span> ${esc(m.teamB)}</span>
          <span class="slot__time u-num">${esc(m.time)} WITA</span>
        </span>
        <span class="slot__table">L${esc((m.mejas || [m.meja]).join(' & L'))}</span>
      </button>
    `;
  });
  list.innerHTML = html;
}

function renderScheduleCount() {
  const el = document.getElementById('schedule-count');
  if (!el) return;
  const state = getState();
  const known = new Set(Object.keys(state.results || {}));
  state.tables.forEach(t => { if (t.match) known.add(t.match); });
  el.textContent = `${known.size}/${SCHEDULE.length} dimuat`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   EVENT HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-role]');
  if (!el) return;
  const role = el.dataset.role;
  const meja = el.dataset.meja ? Number(el.dataset.meja) : null;

  try {
    switch (role) {
      case 'set-active':       await setActiveMeja(Number(el.dataset.n)); break;
      case 'team-popbtn':      onToggleTeamPop(meja, el.dataset.side); break;
      case 'team-pick':        await onPickTeam(meja, el.dataset.side, el.dataset.team); break;
      case 'set-status':       await onSetStatus(meja, el.dataset.status); break;
      case 'finish':           await onFinish(meja); break;
      case 'reopen':           await onReopen(meja); break;
      case 'toggle-display':   await toggleTableDisplay(meja); break;
      case 'reset-table':      await onResetTable(meja); break;
      case 'edit-cats':        onToggleEditor(meja); break;
      case 'cat-add':          await onCatAdd(meja); break;
      case 'cat-remove':       await onCatRemove(meja, Number(el.dataset.index)); break;
      case 'cat-move':         await onCatMove(meja, Number(el.dataset.index), Number(el.dataset.dir)); break;
      case 'cat-reset':        await onCatReset(meja); break;
      case 'load-match':       await onLoadMatch(el.dataset.match); break;

      case 'load-match-from-jadwal': await onLoadMatch(el.dataset.match); break;
      case 'open-controller':
        window.open(`controller.html?meja=${el.dataset.meja}`, '_blank');
        break;
      case 'open-tv-1':
      case 'open-tv-2':
      case 'open-tv-3':
      case 'open-tv-4': {
        const n = role.slice(-1);
        window.open(`tv.html?meja=${n}`, '_blank');
        break;
      }
      case 'open-display-new':
        window.open('display.html?popup', 'korsa-display', 'width=1280,height=720');
        break;
      case 'set-vt-mode':      await setVtMode(el.dataset.mode); break;
      case 'set-ratio':        await setRatio(el.dataset.ratio); break;
      case 'reset-all':
        if (!confirmAsk('Reset SEMUA data?')) return;
        await resetAll();
        toast('Semua data direset', 'info');
        break;

      case 'logout':           await onLogout(); break;
    }
  } catch (err) {
    toast(err.message || 'Terjadi kesalahan', 'error');
  }
});

document.addEventListener('input', e => {
  const teamEl = e.target.closest('[data-role="team-input"]');
  if (teamEl) {
    onTeamInput(Number(teamEl.dataset.meja), teamEl.dataset.side, teamEl);
    return;
  }
  const catEl = e.target.closest('[data-role="cat-name"]');
  if (catEl) {
    onCatRename(Number(catEl.dataset.meja), Number(catEl.dataset.index), catEl.value);
  }
});

/* ── Handlers ─────────────────────────────────────────────────────────────── */

const teamDebounce = new Map();
function onTeamInput(meja, side, el) {
  const upper = el.value.toUpperCase();
  if (el.value !== upper) {
    const pos = el.selectionStart;
    el.value = upper;
    try { el.setSelectionRange(pos, pos); } catch (e) {}
  }
  const row = document.querySelector(`.match[data-meja="${meja}"] .side[data-side="${side}"]`);
  if (row) {
    const plate = row.querySelector('.side__logo');
    if (plate) plate.outerHTML = plateHTML(upper, 'side__logo');
  }
  const key = `${meja}-${side}`;
  clearTimeout(teamDebounce.get(key));
  teamDebounce.set(key, setTimeout(async () => {
    try { await setTeam(meja, side, upper); }
    catch (e) { toast('Gagal simpan nama tim: ' + e.message, 'error'); }
  }, 400));
}

function onToggleTeamPop(meja, side) {
  if (openPopSide && openPopSide.meja === meja && openPopSide.side === side) {
    closeTeamPop();
    return;
  }
  openPopSide = { meja, side };
  renderBoard();
}

function closeTeamPop() {
  if (!openPopSide) return;
  openPopSide = null;
  renderBoard();
}

async function onPickTeam(meja, side, name) {
  await setTeam(meja, side, name);
  openPopSide = null;
  toast(`Lapangan ${meja} tim ${side} → ${name}`, 'success', 1600);
}

async function onSetStatus(meja, status) {
  const t = getTable(meja);
  if (!t || t.status === status) return;
  if (status === 'finished') { await onFinish(meja); return; }
  await setStatus(meja, status);
}

async function onFinish(meja) {
  const t = getTable(meja);
  const check = canFinish(t);
  if (!check.ok) { toast(finishReason(check), 'error'); return; }
  await finishMatch(meja);
  const finished = getTable(meja);
  const winnerName = finished?.winner === 'A' ? finished.teamA : finished?.teamB;
  toast(`Lapangan ${meja}: ${winnerName || 'Pemenang'} menang`, 'success', 3200);
}

async function onReopen(meja) {
  if (!confirmAsk(`Buka kembali pertandingan lapangan ${meja}?`)) return;
  await reopenMatch(meja);
  toast(`Lapangan ${meja} dibuka kembali`, 'info');
}

async function onResetTable(meja) {
  if (!confirmAsk(`Nol-kan skor lapangan ${meja}? Semua hasil kategori akan hilang.`)) return;
  await resetTable(meja);
  toast(`Lapangan ${meja} dinolkan`, 'info');
}

function onToggleEditor(meja) {
  openEditorMeja = (openEditorMeja === meja) ? null : meja;
  openPopSide = null;
  renderBoard();
}

function closeCategoryEditor() {
  if (openEditorMeja === null) return;
  openEditorMeja = null;
  renderBoard();
}

async function onCatAdd(meja) {
  await addCategory(meja, 'Kategori Baru');
  toast('Kategori ditambahkan', 'success', 1400);
}

async function onCatRemove(meja, index) {
  const t = getTable(meja);
  const cat = t && t.categories[index];
  if (!cat) return;
  if (cat.winner) { toast('Tidak bisa hapus kategori yang sudah ada pemenang', 'error'); return; }
  if (!confirmAsk(`Hapus kategori "${cat.name}"?`)) return;
  await removeCategory(meja, index);
  toast('Kategori dihapus', 'info', 1400);
}

async function onCatMove(meja, index, dir) {
  await moveCategory(meja, index, dir);
}

const catRenameDebounce = new Map();
function onCatRename(meja, index, value) {
  const key = `${meja}-${index}`;
  clearTimeout(catRenameDebounce.get(key));
  catRenameDebounce.set(key, setTimeout(async () => {
    try { await renameCategory(meja, index, value); }
    catch (e) { toast('Gagal rename: ' + e.message, 'error'); }
  }, 400));
}

async function onCatReset(meja) {
  if (!confirmAsk(`Reset daftar kategori lapangan ${meja} ke default? Semua hasil kategori akan hilang.`)) return;
  await resetCategories(meja);
  toast('Kategori direset ke default', 'info');
}

async function onLoadMatch(matchId) {
  const m = MATCH_BY_ID[matchId];
  if (!m) return;
  const targets = m.mejas || [m.meja];
  const busyTables = targets.filter(isTableBusy).map(getTable).filter(Boolean);

  if (busyTables.length) {
    const busy = busyTables.map(t => `Lapangan ${t.id}: ${t.teamA} vs ${t.teamB}`).join('\n');
    if (!confirmAsk(`${busy}\n\nTimpa dengan jadwal ${matchId}?`)) return;
  }

  await loadMatch(matchId);
  toast(`Jadwal ${matchId} dimuat ke Lapangan ${targets.join(' dan ')}`, 'success');
}

async function onLogout() {
  if (!confirmAsk('Keluar dari akun ini?')) return;
  try {
    const { doLogout } = await import('./auth.js');
    await doLogout();
  } catch (e) {
    toast('Gagal logout', 'error');
  }
}

function finishReason(check) {
  switch (check.reason) {
    case 'undecided': return `Belum ada kategori yang dimainkan`;
    case 'incomplete': return `Penyisihan harus menyelesaikan semua kategori (${check.decided}/${check.total})`;
    case 'not-clinched': return `Babak gugur membutuhkan ${check.required} kemenangan`;
    case 'tied':      return `Skor seri ${check.a}–${check.b}, harus ada pemenang`;
    default:          return 'Belum bisa diselesaikan';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   HEADER & DATALIST
   ═══════════════════════════════════════════════════════════════════════════ */

export function renderAdminHeader() {
  const logo = document.getElementById('sidebar-logo');
  if (logo) logo.src = KORSA_ON_LIGHT;
}

export function renderTeamNamesDatalist() {
  const el = document.getElementById('team-names');
  if (!el) return;
  el.innerHTML = Object.keys(LOGOS).map(n => `<option value="${esc(n)}"></option>`).join('');
}

