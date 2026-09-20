/* ═══════════════════════════════════════════════════════════════════════════
   DISPLAY INIT — bootstrap halaman display
   ═══════════════════════════════════════════════════════════════════════════ */
import { initState, whenReady } from './state.js';
import { initDisplay } from './display.js';

async function main() {
  await initState({ eager: true });
  await whenReady();

  initDisplay();

  /* Kalau dibuka sebagai popup dari admin, minta fullscreen */
  if (new URLSearchParams(location.search).has('popup')) {
    setTimeout(() => {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }, 500);
  }
}

main().catch(err => {
  console.error('[display-init]', err);
});
