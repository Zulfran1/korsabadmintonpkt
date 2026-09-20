/* ═══════════════════════════════════════════════════════════════════════════
   AUTH — login form, session check, guard halaman
   ═══════════════════════════════════════════════════════════════════════════ */

import { login as apiLogin, logout as apiLogout, me as apiMe } from './api.js';
import { KORSA_ON_LIGHT } from './config.js';
import { esc, toast } from './util.js';

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIN SCREEN — render form login
   ═══════════════════════════════════════════════════════════════════════════ */

export function renderLoginScreen(target, { onSuccess } = {}) {
  if (!target) return;
  target.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-brand">
          <img src="${esc(KORSA_ON_LIGHT)}" alt="KORSA 2026" decoding="async">
        </div>
        <h1 class="login-title">Masuk</h1>
        <p class="login-sub">Gunakan akun yang diberikan panitia</p>

        <form class="login-form" autocomplete="off">
          <label class="login-field">
            <span class="login-field__label">Username</span>
            <input type="text" name="username" autocomplete="username"
                   required autofocus>
          </label>
          <label class="login-field">
            <span class="login-field__label">Password</span>
            <input type="password" name="password" autocomplete="current-password"
                   required>
          </label>

          <button type="submit" class="btn btn--primary login-submit">
            <span class="login-submit__text">Masuk</span>
            <span class="login-submit__spinner" hidden>⏳</span>
          </button>

          <div class="login-error" hidden></div>
        </form>
      </div>
    </div>
  `;

  const form = target.querySelector('.login-form');
  const errEl = target.querySelector('.login-error');
  const submitBtn = target.querySelector('.login-submit');
  const submitText = target.querySelector('.login-submit__text');
  const submitSpin = target.querySelector('.login-submit__spinner');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errEl.hidden = true;

    const username = form.username.value.trim();
    const password = form.password.value;
    if (!username || !password) return;

    /* Loading state */
    submitText.hidden = true;
    submitSpin.hidden = false;
    submitBtn.disabled = true;

    try {
      const r = await apiLogin(username, password);
      toast(`Selamat datang, ${r.user.username}`, 'success', 1600);
      if (typeof onSuccess === 'function') onSuccess(r.user);
    } catch (err) {
      errEl.textContent = err.message || 'Login gagal';
      errEl.hidden = false;
      form.password.value = '';
      form.password.focus();
    } finally {
      submitText.hidden = false;
      submitSpin.hidden = true;
      submitBtn.disabled = false;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   GUARD — cek session, redirect kalau perlu
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Cek session. Return user kalau login, null kalau tidak.
 * Kalau requireLogin dan user null → tampilkan login screen, return null.
 */
export async function requireSession({ role, target, onLogin } = {}) {
  const user = await apiMe();

  /* Belum login → tampilkan form login */
  if (!user) {
    if (target) {
      renderLoginScreen(target, {
        onSuccess: (u) => {
          /* Cek role */
          if (role && u.role !== role) {
            toast(`Halaman ini hanya untuk ${role}`, 'error', 3000);
            /* Kalau bukan admin, tendang ke halaman yang sesuai */
            setTimeout(() => redirectByRole(u.role), 1000);
            return;
          }
          if (typeof onLogin === 'function') onLogin(u);
        },
      });
    }
    return null;
  }

  /* Sudah login tapi role tidak cocok */
  if (role && user.role !== role) {
    toast(`Halaman ini hanya untuk ${role}`, 'error', 3000);
    setTimeout(() => redirectByRole(user.role), 1000);
    return null;
  }

  return user;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOGOUT — hapus session + redirect
   ═══════════════════════════════════════════════════════════════════════════ */

export async function doLogout() {
  try {
    await apiLogout();
  } catch (e) {
    /* Kalau server error, tetap paksa logout di client */
  }
  location.reload();
}

/* ═══════════════════════════════════════════════════════════════════════════
   REDIRECT — arahkan user ke halaman yang sesuai role
   ═══════════════════════════════════════════════════════════════════════════ */

export function redirectByRole(role) {
  if (role === 'admin') {
    location.replace('admin.html');
  } else if (role === 'operator') {
    location.replace('controller.html');
  } else {
    location.replace('display.html');
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   USER CHIP — update UI dengan info user
   ═══════════════════════════════════════════════════════════════════════════ */

export function renderUserChip(user) {
  const chip = document.getElementById('user-chip');
  if (!chip || !user) return;

  const avatar = chip.querySelector('.user-chip__avatar');
  const label = chip.querySelector('.user-chip__label') || chip.querySelector('span:last-child');

  const initials = user.role === 'admin'
    ? 'A'
    : `L${user.meja || '?'}`;

  if (avatar) avatar.textContent = initials;
  if (label) label.textContent = user.role === 'admin' ? 'ADMIN' : `LAPANGAN ${user.meja}`;
}
