import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_JSON_BYTES, readJSON, requireMethod } from '../netlify/functions/_lib/respond.mjs';
import { toPublicState } from '../netlify/functions/state.mjs';

test('request JSON terlalu besar ditolak sebelum diproses', async () => {
  const request = new Request('http://localhost/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: 'a'.repeat(MAX_JSON_BYTES) }),
  });
  assert.equal(await readJSON(request), null);
});

test('response method tidak valid menyertakan header Allow', async () => {
  const response = requireMethod(new Request('http://localhost/api/state', { method: 'POST' }), 'GET');
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
});

test('state publik tidak membocorkan log, hasil, atau state admin', () => {
  const state = {
    version: 7,
    updatedAt: '2026-09-19T00:00:00.000Z',
    activeMeja: 2,
    ratio: '16:9',
    vtMode: 'all',
    loaded: { 1: 'P1' },
    results: { P1: { winner: 'AMONIAK' } },
    tables: [{ id: 1, status: 'live', logs: [{ by: 'operator-rahasia' }] }],
  };
  const visible = toPublicState(state);
  assert.equal(visible.loaded, undefined);
  assert.equal(visible.results, undefined);
  assert.equal(visible.tables[0].logs, undefined);
  assert.equal(visible.tables[0].status, 'live');
  assert.equal(state.tables[0].logs.length, 1, 'sanitasi tidak boleh mengubah state asli');
});
