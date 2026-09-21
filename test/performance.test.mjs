import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('sinkronisasi UI tidak menumpuk polling atau render dalam satu frame', async () => {
  const [state, admin, controller, display, tv] = await Promise.all([
    readFile(new URL('../public/js/state.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/js/admin.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/js/controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/js/display.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/js/tv.js', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(state, /setInterval\(async\s*\(\)\s*=>[\s\S]*?fetchState/);
  assert.match(state, /document\.hidden\s*\?\s*12000\s*:\s*3000/);
  assert.match(state, /pollTimer\s*=\s*window\.setTimeout\(poll/);
  assert.match(admin, /subscribe\(scheduleRenderAll,\s*\{\s*immediate:\s*false\s*\}\)/);
  assert.match(controller, /subscribe\(scheduleRenderAll,\s*\{\s*immediate:\s*false\s*\}\)/);
  assert.match(controller, /nextKey === renderedTableKey/);
  assert.match(display, /window\.addEventListener\('resize',\s*scheduleDisplayRender\)/);
  assert.match(tv, /window\.addEventListener\('resize',\s*scheduleTVRender\)/);
  assert.match(tv, /nextKey === renderedTableKey/);
  assert.doesNotMatch(tv, /console\.log\('\[TV\]/);
});

test('Display dan TV merender segera lalu menyinkronkan state di belakang', async () => {
  const [state, displayInit, tvInit] = await Promise.all([
    readFile(new URL('../public/js/state.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/js/display-init.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/js/tv-init.js', import.meta.url), 'utf8'),
  ]);

  assert.match(displayInit, /initState\(\{\s*eager:\s*true\s*\}\)/);
  assert.match(tvInit, /initState\(\{\s*eager:\s*true\s*\}\)/);
  assert.match(state, /localStorage\.setItem\(STATE_CACHE_KEY/);
  assert.match(state, /void loadInitialState\(\)/);
  assert.match(state, /new window\.BroadcastChannel/);
  assert.match(state, /broadcastChannel\.postMessage\(publicSnapshot\(source\)\)/);
});

test('startup halaman berprivilege tidak menunggu session dan state secara serial', async () => {
  const [adminInit, controllerInit, tv] = await Promise.all([
    readFile(new URL('../public/js/admin-init.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/js/controller-init.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/js/tv.js', import.meta.url), 'utf8'),
  ]);

  for (const source of [adminInit, controllerInit]) {
    assert.match(source, /const stateReady = initState\(\{\s*poll:\s*false\s*\}\);[\s\S]*?await requireSession/);
    assert.match(source, /await stateReady;[\s\S]*?await whenReady\(\);[\s\S]*?startStatePolling\(\)/);
  }
  assert.equal((tv.match(/startClock\(\);/g) || []).length, 1);
  assert.match(tv, /const contentHeight = inner\.scrollHeight \/ 2/);
  assert.match(tv, /SCROLL_SPEED_PX_S \* \(dt \/ 1000\)/);
  assert.doesNotMatch(tv, /if \(document\.hidden\)[\s\S]*?scrollRAF = null/);
});

test('function membaca session dan state secara paralel', async () => {
  const [action, state] = await Promise.all([
    readFile(new URL('../netlify/functions/action.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../netlify/functions/state.mjs', import.meta.url), 'utf8'),
  ]);

  assert.match(action, /Promise\.all\(\[\s*getUser\(req\)[\s\S]*?loadStateForUpdate\(\)/);
  assert.match(state, /Promise\.all\(\[loadState\(\),\s*getUser\(req\)\]\)/);
});
