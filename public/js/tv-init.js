import { initState, whenReady } from './state.js';
import { initTV } from './tv.js';

async function main() {
  const params = new URLSearchParams(location.search);
  const meja = Number(params.get('meja')) || 1;

  await initState();
  await whenReady();

  initTV(meja);
}

main().catch(err => console.error('[tv-init]', err));