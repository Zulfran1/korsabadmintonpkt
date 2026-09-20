import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

import authHandler from '../netlify/functions/auth.mjs';
import meHandler from '../netlify/functions/me.mjs';
import stateHandler from '../netlify/functions/state.mjs';
import actionHandler from '../netlify/functions/action.mjs';
import logoutHandler from '../netlify/functions/logout.mjs';

function request(path, { method = 'GET', cookie = '', body } = {}) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function json(handler, req) {
  const response = await handler(req);
  return { response, data: await response.json() };
}

async function login(username, password) {
  const { response, data } = await json(authHandler, request('/api/auth', {
    method: 'POST',
    body: { username, password },
  }));
  return {
    response,
    data,
    cookie: response.headers.get('set-cookie')?.split(';')[0] || '',
  };
}

test('alur lengkap admin, controller, state publik, dan logout berfungsi', async () => {
  process.env.ADMIN_USERNAME = 'e2e-admin';
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('e2e-admin-pass', 4);
  process.env.OP1_USERNAME = 'e2e-controller-1';
  process.env.OP1_PASSWORD_HASH = bcrypt.hashSync('e2e-controller-pass', 4);
  process.env.OP1_MEJA = '1';

  const admin = await login('e2e-admin', 'e2e-admin-pass');
  assert.equal(admin.response.status, 200);
  assert.ok(admin.cookie.startsWith('korsa_session='));

  let result = await json(meHandler, request('/api/me', { cookie: admin.cookie }));
  assert.deepEqual(result.data.user, { username: 'e2e-admin', role: 'admin', meja: null });

  result = await json(stateHandler, request('/api/state', { cookie: admin.cookie }));
  assert.equal(result.response.status, 200);
  assert.ok(result.data.loaded, 'admin menerima state internal lengkap');
  let version = result.data.version;

  result = await json(actionHandler, request('/api/action', {
    method: 'POST', cookie: admin.cookie,
    body: {
      type: 'load-match', table: 1, tables: [1, 2], match: 'P1', pool: 'A',
      phase: 'PENYISIHAN', teamA: 'BIODEX', teamB: 'AMONIAK', version,
    },
  }));
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.deepEqual(result.data.state.loaded.P1, [1, 2]);
  version = result.data.state.version;

  const operator = await login('e2e-controller-1', 'e2e-controller-pass');
  assert.equal(operator.response.status, 200);
  result = await json(actionHandler, request('/api/action', {
    method: 'POST', cookie: operator.cookie,
    body: {
      type: 'set-category', table: 1, index: 0,
      sets: [{ a: 15, b: 10 }, { a: 15, b: 12 }], version,
    },
  }));
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.state.tables[0].categories[0].winner, 'A');
  assert.equal(result.data.state.tables[1].categories[0].winner, 'A');
  assert.match(result.data.state.tables[0].logs[0].message, /15–10 · 15–12/);
  version = result.data.state.version;

  result = await json(actionHandler, request('/api/action', {
    method: 'POST', cookie: operator.cookie,
    body: { type: 'set-status', table: 3, status: 'live', version },
  }));
  assert.equal(result.response.status, 403, 'operator tidak boleh mengubah lapangan lain');

  result = await json(stateHandler, request('/api/state'));
  assert.equal(result.response.status, 200);
  assert.equal(result.data.loaded, undefined);
  assert.equal(result.data.results, undefined);
  assert.equal(result.data.tables[0].logs, undefined);
  assert.equal(result.data.tables[0].teamA, 'BIODEX');

  result = await json(logoutHandler, request('/api/logout', {
    method: 'POST', cookie: operator.cookie,
  }));
  assert.equal(result.response.status, 200);
  result = await json(meHandler, request('/api/me', { cookie: operator.cookie }));
  assert.equal(result.data.user, null);
});
