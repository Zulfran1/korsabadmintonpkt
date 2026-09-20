/* ═══════════════════════════════════════════════════════════════════════════
   UTIL — helper yang dipakai di semua halaman
   KORSA 2026 Bulu Tangkis
   ═══════════════════════════════════════════════════════════════════════════ */
import { LOGOS } from './config.js';

/* ── Escape HTML — WAJIB untuk semua string yang masuk innerHTML ───────── */
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/* ── Normalisasi nama tim: uppercase, rapikan spasi ─────────────────────── */
export const normalize = name =>
  String(name || '').trim().toUpperCase().replace(/\s+/g, ' ');

/* ── Monogram 2–3 huruf untuk tim tanpa logo ────────────────────────────── */
export function monogram(name) {
  const n = normalize(name);
  if (!n) return '—';
  const all = n.split(' ');
  /* 'NPK' dan 'TIM' diabaikan supaya monogram lebih bermakna
     (mis. "NPK JOS" → "JOS", bukan "NJ") */
  const words = all.filter(w => w !== 'NPK' && w !== 'TIM');
  const base = words.length ? words : all;
  return base.length === 1
    ? base[0].slice(0, 3)
    : base.map(w => w[0]).join('').slice(0, 3);
}

/* ── Plate logo: gambar kalau ada, monogram kalau tidak ─────────────────── */
export function plateHTML(name, cls = '') {
  const src = LOGOS[normalize(name)];
  if (src) {
    return `<div class="plate ${esc(cls)}">` +
           `<img src="${esc(src)}" alt="" loading="lazy" decoding="async"></div>`;
  }
  return `<div class="plate plate--mono ${esc(cls)}">${esc(monogram(name))}</div>`;
}

/* ── Pill status ────────────────────────────────────────────────────────── */
export function pillHTML(status) {
  const label = { waiting: 'Menunggu', live: 'Live', finished: 'Selesai' }[status] || status;
  return `<span class="pill pill--${esc(status)}"><span class="dot"></span>${esc(label)}</span>`;
}

/* ── Jam WITA (HH:MM:SS) ────────────────────────────────────────────────── */
export function clockText(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* ── Format skor set untuk ditampilkan ──────────────────────────────────── */
/* Input: '2-0' | '2-1' | '0-2' | '1-2' → Output: objek terstruktur */
export function parseSets(sets) {
  if (!sets) return null;
  const m = String(sets).match(/^(\d)-(\d)$/);
  if (!m) return null;
  return { a: Number(m[1]), b: Number(m[2]) };
}

/* ── Timestamp → jam:menit:detik lokal (untuk log) ─────────────────────── */
export function timeOf(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* ── Timestamp → tanggal YYYY-MM-DD (untuk nama file log) ──────────────── */
export function dateKey(ts = Date.now()) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST — notifikasi kecil di atas layar
   Dipakai controller & admin untuk feedback (sukses, error, undo, dsb).
   ═══════════════════════════════════════════════════════════════════════════ */

let toastStack = null;

function ensureToastStack() {
  if (toastStack && document.body.contains(toastStack)) return toastStack;
  toastStack = document.createElement('div');
  toastStack.className = 'toast-stack';
  toastStack.setAttribute('role', 'status');
  toastStack.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastStack);
  return toastStack;
}

/**
 * Tampilkan toast.
 * @param {string} message  teks pesan
 * @param {'info'|'success'|'error'} kind  jenis toast
 * @param {number} ms  durasi tampil (default 2200ms)
 */
export function toast(message, kind = 'info', ms = 2200) {
  const stack = ensureToastStack();
  const el = document.createElement('div');
  el.className = 'toast' + (kind !== 'info' ? ` toast--${kind}` : '');
  el.textContent = String(message);
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    setTimeout(() => el.remove(), 260);
  }, ms);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIRM — dialog konfirmasi sederhana (native)
   Dibungkus supaya gampang diganti ke modal custom nanti.
   ═══════════════════════════════════════════════════════════════════════════ */
export function confirmAsk(message) {
  return window.confirm(String(message || 'Lanjutkan?'));
}

/* ═══════════════════════════════════════════════════════════════════════════
   FIT TEXT — kecilkan font sampai teks muat dalam lebar elemen
   Dipakai display untuk nama tim panjang (mis. "PEREBUTAN 3").
   ═══════════════════════════════════════════════════════════════════════════ */
export function fitText(el, minPx = 12) {
  if (!el) return;
  el.style.fontSize = '';
  const available = el.clientWidth;
  const preferred = parseFloat(getComputedStyle(el).fontSize);
  if (!available || el.scrollWidth <= available) return;

  let low = Math.max(minPx, preferred * 0.48);
  let high = preferred;
  for (let i = 0; i < 8; i++) {
    const size = (low + high) / 2;
    el.style.fontSize = size + 'px';
    if (el.scrollWidth <= available) low = size;
    else high = size;
  }
  el.style.fontSize = low + 'px';
}

/* ── Terapkan fitText ke semua elemen yang cocok di dalam root ─────────── */
export function fitAll(root, selector, minPx = 12) {
  if (!root) return;
  root.querySelectorAll(selector).forEach(el => fitText(el, minPx));
}

/* ═══════════════════════════════════════════════════════════════════════════
   DEBOUNCE — untuk input nama tim (hindari persist tiap ketikan)
   ═══════════════════════════════════════════════════════════════════════════ */
export function debounce(fn, ms = 200) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   DELEGASI KLIK — pasang satu listener untuk banyak elemen
   ═══════════════════════════════════════════════════════════════════════════ */
export function onClick(root, selector, handler) {
  if (!root) return () => {};
  const fn = e => {
    const el = e.target.closest(selector);
    if (!el || !root.contains(el)) return;
    handler(el, e);
  };
  root.addEventListener('click', fn);
  return () => root.removeEventListener('click', fn);
}