/* ═══════════════════════════════════════════════════════════════════════════
   CONTROLLER — layout 2 kolom (papan skor + daftar kategori)
   ═══════════════════════════════════════════════════════════════════════════ */
import {
  getState, getTable, subscribe,
  setTeam, setStatus, toggleTableDisplay, resetTable,
  setCategorySets, clearCategoryResult, finishMatch, reopenMatch,
  canFinish, computeCategoryResult, setWinner,
} from './state.js';
import { MATCH_BY_ID, LOGOS, EVENT, KORSA_ON_LIGHT, RULES } from './config.js';
import {
  esc, plateHTML, pillHTML, clockText,
  toast, confirmAsk, debounce,
} from './util.js';

/* ═══════════════════════════════════════════════════════════════════════════
   STATE LOKAL UI
   ═══════════════════════════════════════════════════════════════════════════ */

let assignedMeja = null;
let activeCatIndex = null;    // kategori yang sedang aktif di papan skor
let openPopSide = null;
let draftSets = [];
let submitting = false;
let clockStarted = false;

/* ═══════════════════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════════════════ */

export function initController(meja) {
  if (![1, 2, 3, 4].includes(meja)) {
    toast('Lapangan tidak valid', 'error');
    return;
  }
  assignedMeja = meja;

  renderAll();
  startClock();
  subscribe(() => renderAll());

  document.addEventListener('click', e => {
    if (!e.target.closest('.ctl-team__pick')) closeTeamPop();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (openPopSide) { closeTeamPop(); return; }
      if (activeCatIndex !== null) { closeActiveCat(); return; }
    }
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
   RENDER
   ═══════════════════════════════════════════════════════════════════════════ */

function renderAll() {
  const t = getTable(assignedMeja);
  if (!t) return;

  /* Kalau belum ada kategori aktif, pilih pertama yang pending + init draft */
  if (activeCatIndex === null) {
    const firstPending = t.categories.findIndex(c => !c.winner);
    activeCatIndex = firstPending >= 0 ? firstPending : 0;
    initDraftFromActive();
  }

  renderMain(t);
  renderAside(t);
}

/* Helper: init draftSets dari kategori aktif */
function initDraftFromActive() {
  const t = getTable(assignedMeja);
  if (!t || activeCatIndex === null) return;
  const cat = t.categories[activeCatIndex];
  if (!cat) return;
  draftSets = (cat.sets || []).map(s => ({ a: s.a, b: s.b }));
  if (draftSets.length === 0) draftSets = [{ a: 0, b: 0 }];
}

/* ── KIRI: Papan Skor ──────────────────────────────────────────────────── */

function renderMain(t) {
  const main = document.getElementById('ctl-main');
  if (!main) return;

  const cat = t.categories[activeCatIndex];
  if (!cat) {
    main.innerHTML = `
      <div class="ctl-empty">
        <div class="ctl-empty__text">Belum ada kategori</div>
      </div>
    `;
    return;
  }

  /* PENTING: draftSets JANGAN di-reset di sini.
     Draft sudah di-init di renderAll() dan selectCategory().
     Reset di sini akan menghapus perubahan yang belum disimpan. */

  const fixture = t.match ? MATCH_BY_ID[t.match] : null;
  const draftResult = computeCategoryResult(draftSets);
  const addSetEnabled = canAddDraftSet();
  const alreadySaved = sameSetScores(draftSets, cat.sets);
  const saveEnabled = draftResult.valid && !alreadySaved && !submitting;
  const saveTitle = !draftResult.valid
    ? 'Lengkapi skor sampai salah satu tim menang 2 set'
    : (alreadySaved ? 'Hasil ini sudah tersimpan' : 'Simpan hasil kategori');
  const saveLabel = submitting
    ? 'Menyimpan…'
    : (!draftResult.valid
      ? 'Menunggu Pemenang 2 Set'
      : (alreadySaved ? '✓ Hasil Sudah Tersimpan' : 'Simpan Hasil Kategori →'));

  main.innerHTML = `
    <header class="ctl-main__head">
      <div class="ctl-main__head-left">
        <span class="ctl-main__table">LAPANGAN ${esc(t.id)}</span>
        ${t.match ? `<span class="ctl-main__code">${esc(t.match)}</span>` : ''}
        ${fixture ? `<span class="ctl-main__phase">${esc(fixture.phase)}</span>` : ''}
      </div>
      <div class="ctl-main__head-right">
        ${pillHTML(t.status)}
      </div>
    </header>

    <div class="ctl-scoreboard">
      ${scoreboardTeamHTML(t, 'A')}
      <div class="ctl-scoreboard__sep">
        <span class="ctl-scoreboard__dash">—</span>
      </div>
      ${scoreboardTeamHTML(t, 'B')}
    </div>

    <div class="ctl-active">
      <div class="ctl-active__head">
        <div class="ctl-active__num">${activeCatIndex + 1}</div>
        <div class="ctl-active__name">${esc(cat.name)}</div>
        ${cat.winner ? `<span class="ctl-active__badge">✓ ${esc(cat.winner === 'A' ? t.teamA : t.teamB)} · ${esc(cat.scoreSet)} · ${esc(rallyScore(cat.sets))}</span>` : ''}
      </div>

      <div class="ctl-sets">
        ${draftSets.map((s, si) => setBlockHTML(t, s, si)).join('')}
      </div>

      <div class="ctl-sets-toolbar">
        <div class="ctl-sets-actions">
          <button class="btn btn--outline ctl-add-set-btn" type="button" data-role="set-add"
                  ${addSetEnabled ? '' : 'disabled'}>
            ${esc(addSetLabel(draftResult))}
          </button>
        </div>
        <div class="ctl-preview">
          ${renderPreview(t)}
        </div>
      </div>

      <div class="ctl-actions">
        ${cat.winner ? `
          <button class="btn btn--quiet btn--danger-quiet" type="button" data-role="cat-clear">
            Hapus Hasil
          </button>
        ` : ''}
        <button class="btn btn--outline" type="button" data-role="cat-reset">Reset Set</button>
        <button class="btn btn--primary" type="button" data-role="cat-save"
                ${saveEnabled ? '' : 'disabled'}
                title="${esc(saveTitle)}">
          ${saveLabel}
        </button>
      </div>
    </div>

    <div class="ctl-log">
      <div class="ctl-log__head">LOG</div>
      <ul class="ctl-log__list">
        ${(t.logs || []).length
          ? t.logs.map(logLineHTML).join('')
          : '<li class="is-empty">Belum ada aktivitas</li>'
        }
      </ul>
    </div>
  `;
}

function logLineHTML(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const date = new Date(entry.at);
  const validDate = Number.isFinite(date.getTime());
  const time = validDate
    ? date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';
  return `<li>
    <time>${esc(time)}</time>
    <span>${esc(entry.message || '')}</span>
    <small>${esc(entry.by || '')}</small>
  </li>`;
}

function renderPreview(t) {
  const result = computeCategoryResult(draftSets);
  if (result.valid) {
    const winnerName = result.winner === 'A' ? t.teamA : t.teamB;
    return `<span class="ctl-preview__ok">✓ ${esc(winnerName)} menang ${esc(result.scoreSet)} · ${esc(rallyScore(draftSets))}</span>`;
  }
  if (draftSets.some(s => !setWinner(s.a, s.b))) {
    return `<span class="ctl-preview__invalid">Lengkapi set aktif: min ${RULES.POINTS_TO_WIN} poin, selisih ${RULES.WIN_BY}</span>`;
  }
  return `<span class="ctl-preview__invalid">Belum ada pemenang 2 set</span>`;
}

function rallyScore(sets) {
  return (sets || []).map(s => `${s.a}–${s.b}`).join(' · ');
}

function sameSetScores(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((set, index) => (
    Number(set.a) === Number(right[index]?.a) && Number(set.b) === Number(right[index]?.b)
  ));
}

function canAddDraftSet() {
  if (draftSets.length >= 3) return false;
  let gamesA = 0;
  let gamesB = 0;
  for (const set of draftSets) {
    const winner = setWinner(set.a, set.b);
    if (!winner) return false;
    if (winner === 'A') gamesA++;
    else gamesB++;
    if (gamesA >= 2 || gamesB >= 2) return false;
  }
  if (draftSets.length === 1) return true;
  return draftSets.length === 2 && gamesA === 1 && gamesB === 1;
}

function addSetLabel(result = computeCategoryResult(draftSets)) {
  if (result.valid) return '✓ Kategori Selesai';
  if (draftSets.length >= 3) return 'Maksimal 3 Set';
  if (draftSets.some(s => !setWinner(s.a, s.b))) {
    return `Selesaikan Set ${draftSets.length} dahulu`;
  }
  return `+ Tambah Set ${draftSets.length + 1}`;
}

function scoreboardTeamHTML(t, side) {
  const name  = side === 'A' ? t.teamA : t.teamB;
  const score = side === 'A' ? t.scoreA : t.scoreB;
  const other = side === 'A' ? t.scoreB : t.scoreA;
  const leading = score > other;
  const popOpen = openPopSide === side;

  return `
    <div class="ctl-team${leading ? ' is-leading' : ''}" data-side="${side}">
      ${plateHTML(name, 'ctl-team__logo')}
      <div class="ctl-team__info">
        <div class="ctl-team__pick">
          <input class="ctl-team__input" type="text" value="${esc(name)}"
                 maxlength="24" list="team-names"
                 data-side="${side}" data-role="team-input"
                 aria-label="Nama tim ${side}">
          <button class="ctl-team__btn" type="button"
                  aria-expanded="${popOpen}"
                  data-side="${side}" data-role="team-popbtn">
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          ${popOpen ? teamPopHTML(side) : ''}
        </div>
      </div>
      <div class="ctl-team__score u-num">${esc(score)}</div>
    </div>
  `;
}

function teamPopHTML(side) {
  return `
    <div class="teampop">
      ${Object.keys(LOGOS).map(name => `
        <button class="teampop__item" type="button"
                data-side="${side}" data-team="${esc(name)}" data-role="team-pick">
          ${plateHTML(name, '')}
          <span>${esc(name)}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function setBlockHTML(t, s, si) {
  const wA = setWinner(s.a, s.b);
  const aWins = wA === 'A';
  const bWins = wA === 'B';

  return `
    <div class="ctl-set" data-set="${si}">
      <div class="ctl-set__head">
        <span class="ctl-set__num">Set ${si + 1}</span>
        ${draftSets.length > 1 ? `
          <button class="ctl-set__del" type="button"
                  data-set="${si}" data-role="set-del"
                  aria-label="Hapus set ${si + 1}">×</button>
        ` : ''}
      </div>

      <div class="ctl-set__grid">
        <div class="ctl-set__team${aWins ? ' is-winner' : ''}" data-side="a">
          ${plateHTML(t.teamA, 'ctl-set__logo')}
          <span class="ctl-set__team-name">${esc(t.teamA)}</span>
          <input class="ctl-set__score-input u-num" type="text"
                 inputmode="numeric" pattern="[0-9]*" maxlength="2"
                 value="${esc(s.a)}" autocomplete="off"
                 data-set="${si}" data-side="a" data-role="set-score"
                 aria-label="Skor ${esc(t.teamA)} set ${si + 1}">
        </div>

        <span class="ctl-set__separator" aria-hidden="true">—</span>

        <div class="ctl-set__team${bWins ? ' is-winner' : ''}" data-side="b">
          <input class="ctl-set__score-input u-num" type="text"
                 inputmode="numeric" pattern="[0-9]*" maxlength="2"
                 value="${esc(s.b)}" autocomplete="off"
                 data-set="${si}" data-side="b" data-role="set-score"
                 aria-label="Skor ${esc(t.teamB)} set ${si + 1}">
          <span class="ctl-set__team-name">${esc(t.teamB)}</span>
          ${plateHTML(t.teamB, 'ctl-set__logo')}
        </div>
      </div>
    </div>
  `;
}

/* ── KANAN: Daftar Kategori ─────────────────────────────────────────────── */

function renderAside(t) {
  const aside = document.getElementById('ctl-aside');
  if (!aside) return;

  const decided = t.categories.filter(c => c.winner).length;
  const total = t.categories.length;

  aside.innerHTML = `
    <div class="ctl-aside__head">
      <span class="ctl-aside__title">DAFTAR KATEGORI</span>
      <span class="ctl-aside__progress">${decided} / ${total}</span>
    </div>

    <ul class="ctl-aside__list">
      ${t.categories.map((c, i) => catAsideHTML(t, c, i)).join('')}
    </ul>

    <div class="ctl-aside__summary">
      <div class="ctl-aside__summary-title">SKOR PERTANDINGAN</div>
      <div class="ctl-aside__summary-row${t.scoreA > t.scoreB ? ' is-lead' : ''}">
        ${plateHTML(t.teamA, 'ctl-aside__summary-logo')}
        <span>${esc(t.teamA)}</span>
        <b class="u-num">${esc(t.scoreA)}</b>
      </div>
      <div class="ctl-aside__summary-row${t.scoreB > t.scoreA ? ' is-lead' : ''}">
        ${plateHTML(t.teamB, 'ctl-aside__summary-logo')}
        <span>${esc(t.teamB)}</span>
        <b class="u-num">${esc(t.scoreB)}</b>
      </div>
    </div>

    <div class="ctl-aside__foot">
      ${t.status === 'finished'
        ? `<button class="btn btn--outline" type="button" data-role="reopen">Buka Kembali</button>`
        : `<button class="btn btn--success" type="button" data-role="finish"
              ${canFinish(t).ok ? '' : 'disabled'}>Selesaikan Pertandingan</button>`
      }
      <button class="btn btn--quiet btn--danger-quiet" type="button" data-role="reset-table">
        Nol-kan Semua
      </button>
    </div>
  `;
}

function catAsideHTML(t, cat, index) {
  const isActive = index === activeCatIndex;
  const hasWinner = !!cat.winner;
  const winnerName = cat.winner === 'A' ? t.teamA : (cat.winner === 'B' ? t.teamB : '');

  let statusLabel = 'Menunggu';
  let statusClass = 'is-waiting';
  if (hasWinner) {
    statusLabel = `${cat.scoreSet} Selesai`;
    statusClass = 'is-done';
  } else if (isActive) {
    statusLabel = 'Sedang Diisi';
    statusClass = 'is-active';
  }

  return `
    <li class="ctl-cat-item${isActive ? ' is-active' : ''}${hasWinner ? ' is-done' : ''}"
        data-index="${index}" data-role="select-cat" tabindex="0" role="button">
      <span class="ctl-cat-item__num">${index + 1}</span>
      <div class="ctl-cat-item__body">
        <div class="ctl-cat-item__name">${esc(cat.name)}</div>
        <div class="ctl-cat-item__meta">
          <span class="ctl-cat-item__status ${statusClass}">${esc(statusLabel)}</span>
          ${hasWinner ? `<span class="ctl-cat-item__winner">${esc(winnerName)}</span>` : ''}
        </div>
        ${hasWinner ? `<div class="ctl-cat-item__rally">Skor: ${esc(rallyScore(cat.sets))}</div>` : ''}
      </div>
      <span class="ctl-cat-item__arrow">${isActive ? '▶' : ''}</span>
    </li>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

function selectCategory(index) {
  activeCatIndex = index;
  openPopSide = null;

  /* Init draft dari kategori yang dipilih */
  initDraftFromActive();

  renderAll();
  requestAnimationFrame(() => {
    const main = document.getElementById('ctl-main');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function closeActiveCat() {
  /* Balik ke kategori pertama yang belum selesai */
  const t = getTable(assignedMeja);
  if (!t) return;
  const firstPending = t.categories.findIndex(c => !c.winner);
  activeCatIndex = firstPending >= 0 ? firstPending : 0;
  renderAll();
}

function onSetScoreInput(setIndex, side, rawValue, input) {
  if (!draftSets[setIndex]) draftSets[setIndex] = { a: 0, b: 0 };
  const digits = String(rawValue).replace(/\D/g, '').slice(0, 2);
  if (input && input.value !== digits) input.value = digits;
  draftSets[setIndex][side] = digits === '' ? '' : Number(digits);

  const t = getTable(assignedMeja);
  const preview = document.querySelector('.ctl-preview');
  if (t && preview) preview.innerHTML = renderPreview(t);
  refreshDraftButtons();
}

function onSetAdd() {
  if (!canAddDraftSet()) return;
  draftSets.push({ a: 0, b: 0 });
  refreshActiveCard();
}

function refreshDraftButtons() {
  const result = computeCategoryResult(draftSets);
  const table = getTable(assignedMeja);
  const category = table?.categories?.[activeCatIndex];
  const alreadySaved = sameSetScores(draftSets, category?.sets || []);
  const addButton = document.querySelector('[data-role="set-add"]');
  if (addButton) {
    addButton.disabled = !canAddDraftSet();
    addButton.textContent = addSetLabel(result);
  }

  const saveButton = document.querySelector('[data-role="cat-save"]');
  if (saveButton) {
    saveButton.disabled = !result.valid || alreadySaved || submitting;
    saveButton.textContent = submitting
      ? 'Menyimpan…'
      : (!result.valid
        ? 'Menunggu Pemenang 2 Set'
        : (alreadySaved ? '✓ Hasil Sudah Tersimpan' : 'Simpan Hasil Kategori →'));
    saveButton.title = !result.valid
      ? 'Lengkapi skor sampai salah satu tim menang 2 set'
      : (alreadySaved ? 'Hasil ini sudah tersimpan' : 'Simpan hasil kategori');
  }
}

function onSetDel(setIndex) {
  if (draftSets.length <= 1) return;
  draftSets.splice(setIndex, 1);
  refreshActiveCard();
}

function refreshActiveCard() {
  const t = getTable(assignedMeja);
  if (!t) return;
  /* Re-render hanya area main, biar aside tidak flicker */
  renderMain(t);
}

async function onSaveCategory() {
  if (submitting) return;
  if (activeCatIndex === null) return;

  const hasIncompleteScore = draftSets.some(s => s.a === '' || s.b === '');
  const cleanSets = draftSets.map(s => ({ a: Number(s.a), b: Number(s.b) }));
  const draftResult = hasIncompleteScore
    ? { valid: false }
    : computeCategoryResult(cleanSets);

  if (!draftResult.valid) {
    toast('Belum bisa disimpan: salah satu tim harus menang 2 set', 'error');
    return;
  }

  submitting = true;
  refreshActiveCard();

  try {
    await setCategorySets(assignedMeja, activeCatIndex, cleanSets);
    const t = getTable(assignedMeja);
    const cat = t.categories[activeCatIndex];
    const winnerName = cat.winner === 'A' ? t.teamA : t.teamB;

    toast(`✓ ${cat.name}: ${winnerName} ${cat.scoreSet} · ${rallyScore(cat.sets)}`, 'success', 2600);

    /* Auto-lompat ke kategori berikutnya yang belum selesai */
    const nextPending = t.categories.findIndex((c, i) => !c.winner && i !== activeCatIndex);
    if (nextPending >= 0) activeCatIndex = nextPending;
    else if (t.categories[activeCatIndex].winner === null) {
      /* Stay di kategori yang sama kalau masih ada yang kosong */
    } else {
      /* Semua kategori sudah diisi — biarkan di kategori terakhir */
    }

    /* Init draft untuk kategori berikutnya */
    initDraftFromActive();

    submitting = false;
    renderAll();
  } catch (e) {
    submitting = false;
    toast('Gagal simpan: ' + e.message, 'error');
    refreshActiveCard();
  }
}
async function onClearCategory() {
  if (activeCatIndex === null) return;
  if (!confirmAsk('Hapus hasil kategori ini?')) return;

  try {
    await clearCategoryResult(assignedMeja, activeCatIndex);
    toast('Hasil kategori dihapus', 'info');
  } catch (e) {
    toast('Gagal: ' + e.message, 'error');
  }
}

function onResetSet() {
  draftSets = [{ a: 0, b: 0 }];
  refreshActiveCard();
}

async function onSetStatus(status) {
  const t = getTable(assignedMeja);
  if (!t || t.status === status) return;
  if (status === 'finished') { await onFinish(); return; }
  try { await setStatus(assignedMeja, status); }
  catch (e) { toast('Gagal: ' + e.message, 'error'); }
}

async function onFinish() {
  const t = getTable(assignedMeja);
  const check = canFinish(t);
  if (!check.ok) { toast(finishReason(check), 'error'); return; }

  const winnerName = t.scoreA > t.scoreB ? t.teamA : t.teamB;
  if (!confirmAsk(`Selesaikan pertandingan?\n\nPemenang: ${winnerName}\nSkor: ${t.scoreA}–${t.scoreB}`)) return;

  try {
    await finishMatch(assignedMeja);
    toast(`Pemenang: ${winnerName}`, 'success', 3200);
  } catch (e) { toast('Gagal: ' + e.message, 'error'); }
}

async function onReopen() {
  if (!confirmAsk('Buka kembali pertandingan?')) return;
  try {
    await reopenMatch(assignedMeja);
    toast('Pertandingan dibuka kembali', 'info');
  } catch (e) { toast('Gagal: ' + e.message, 'error'); }
}

async function onResetTable() {
  if (!confirmAsk('Nol-kan seluruh pertandingan? Semua hasil kategori hilang.')) return;
  try {
    await resetTable(assignedMeja);
    activeCatIndex = null;
    toast('Skor lapangan dinolkan', 'info');
  } catch (e) { toast('Gagal: ' + e.message, 'error'); }
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

/* ── Team input ─────────────────────────────────────────────────────────── */

function onTeamInput(side, value) {
  const upper = value.toUpperCase();
  const el = document.querySelector(`[data-role="team-input"][data-side="${side}"]`);
  if (el && el.value !== upper) {
    const pos = el.selectionStart;
    el.value = upper;
    try { el.setSelectionRange(pos, pos); } catch (e) {}
  }
  debouncedSetTeam(side, upper);
}

const debouncedSetTeam = debounce(async (side, value) => {
  try { await setTeam(assignedMeja, side, value); }
  catch (e) { toast('Gagal simpan nama tim: ' + e.message, 'error'); }
}, 400);

function onToggleTeamPop(btn) {
  const side = btn.dataset.side;
  if (openPopSide === side) { closeTeamPop(); return; }
  openPopSide = side;
  renderAll();
}

function closeTeamPop() {
  if (!openPopSide) return;
  openPopSide = null;
  renderAll();
}

async function onPickTeam(el) {
  const side = el.dataset.side;
  const name = el.dataset.team;
  try {
    await setTeam(assignedMeja, side, name);
    openPopSide = null;
    toast(`Tim ${side} → ${name}`, 'success', 1600);
  } catch (e) {
    toast('Gagal: ' + e.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   EVENT HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-role]');
  if (!el) return;
  const role = el.dataset.role;

  try {
    switch (role) {
      case 'team-popbtn':   onToggleTeamPop(el); break;
      case 'team-pick':     await onPickTeam(el); break;
      case 'select-cat':    selectCategory(Number(el.dataset.index)); break;
      case 'set-add':       onSetAdd(); break;
      case 'set-del':       onSetDel(Number(el.dataset.set)); break;
      case 'cat-save':      await onSaveCategory(); break;
      case 'cat-clear':     await onClearCategory(); break;
      case 'cat-reset':     onResetSet(); break;
      case 'finish':        await onFinish(); break;
      case 'reopen':        await onReopen(); break;
      case 'reset-table':   await onResetTable(); break;
      case 'logout':        await onLogout(); break;
    }
    } catch (err) {
    console.error('[CONTROLLER ERROR]', err);
    submitting = false;
    toast(err.message || 'Terjadi kesalahan', 'error');
  }
});

document.addEventListener('keydown', e => {
  const catEl = e.target.closest('[data-role="select-cat"]');
  if (!catEl) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    selectCategory(Number(catEl.dataset.index));
  }
});

document.addEventListener('input', e => {
  const teamEl = e.target.closest('[data-role="team-input"]');
  if (teamEl) onTeamInput(teamEl.dataset.side, teamEl.value);

  const scoreEl = e.target.closest('[data-role="set-score"]');
  if (scoreEl) {
    onSetScoreInput(
      Number(scoreEl.dataset.set),
      scoreEl.dataset.side,
      scoreEl.value,
      scoreEl,
    );
  }
});

document.addEventListener('focusin', e => {
  const scoreEl = e.target.closest('[data-role="set-score"]');
  if (scoreEl) scoreEl.select();
});

/* ═══════════════════════════════════════════════════════════════════════════
   HEADER & DATALIST
   ═══════════════════════════════════════════════════════════════════════════ */

export function renderTeamNamesDatalist() {
  const el = document.getElementById('team-names');
  if (!el) return;
  el.innerHTML = Object.keys(LOGOS).map(n => `<option value="${esc(n)}"></option>`).join('');
}

export function renderControllerHeader() {
  const logo = document.getElementById('brand-logo');
  if (logo) logo.src = KORSA_ON_LIGHT;
  const title = document.getElementById('brand-title');
  if (title) title.textContent = `SCORING ${EVENT.name.toUpperCase()}`;
  const meta = document.getElementById('brand-meta');
  if (meta) meta.textContent = `${EVENT.venue} · ${EVENT.dateRange}`;
}
