/* ═══════════════════════════════════════════════════════════════════════════
   CONTROLLER INIT
   ═══════════════════════════════════════════════════════════════════════════ */
import { initState, setCurrentUser, startStatePolling, whenReady } from './state.js';
import {
  initController,
  renderControllerHeader,
  renderTeamNamesDatalist,
} from './controller.js';
import { requireSession, renderUserChip } from './auth.js';

async function main() {
  const params = new URLSearchParams(location.search);
  const meja = Number(params.get('meja')) || 1;

  /* Fetch state berjalan paralel dengan pengecekan sesi untuk memangkas
     startup pada jaringan seluler/Netlify cold start. */
  const stateReady = initState({ poll: false });

  /* Izinkan admin & operator. Cek role dilakukan manual di bawah. */
  const user = await requireSession({
    role: null,
    target: document.body,
    onLogin: () => location.reload(),
  });

  /* Kalau belum login → login screen sudah di-render, stop */
  if (!user) return;

  /* Sudah login → cek meja */
  if (user.role === 'operator' && user.meja !== meja) {
    location.replace(`controller.html?meja=${user.meja}`);
    return;
  }

  /* Tunggu state yang sudah dimulai di atas. */
  await stateReady;
  await whenReady();
  startStatePolling();

  /* Render UI */
  renderControllerHeader();
  renderTeamNamesDatalist();
  setCurrentUser(user);
  initController(meja);
  renderUserChip(user);

  /* Tombol pratinjau */
  document.getElementById('btn-preview')?.addEventListener('click', () => {
    window.open('display.html?popup', 'korsa-display', 'width=1280,height=720');
  });
}

main().catch(err => {
  console.error('[controller-init]', err);
});
