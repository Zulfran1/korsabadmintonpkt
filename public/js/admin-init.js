import { initState, setCurrentUser, startStatePolling, whenReady } from './state.js';
import {
  initAdmin,
  renderAdminHeader,
  renderTeamNamesDatalist,
} from './admin.js';
import { bindAdminSidebar } from './admin-sidebar.js';
import { requireSession, renderUserChip } from './auth.js';

async function main() {
  /* Shell harus interaktif meski state/login masih dimuat. */
  bindAdminSidebar();
  renderAdminHeader();
  renderTeamNamesDatalist();

  /* Session dan state tidak saling bergantung. Mulai keduanya bersamaan agar
     waktu masuk ditentukan request paling lambat, bukan jumlah dua request. */
  const stateReady = initState({ poll: false });
  const user = await requireSession({
    role: 'admin',
    target: document.body,
    onLogin: () => location.reload(),
  });
  if (!user) return;

  await stateReady;
  await whenReady();
  startStatePolling();

  setCurrentUser(user);
  initAdmin();
  renderUserChip(user);

  /* Buka display */
  document.getElementById('btn-display')?.addEventListener('click', () => {
    window.open('display.html?popup', 'korsa-display', 'width=1280,height=720');
  });

  /* Logout */
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    const { doLogout } = await import('./auth.js');
    doLogout();
  });
}

main().catch(err => console.error('[admin-init]', err));
