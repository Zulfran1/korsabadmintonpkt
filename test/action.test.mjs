import test from 'node:test';
import assert from 'node:assert/strict';

import actionHandler from '../netlify/functions/action.mjs';
import { createSession } from '../netlify/functions/_lib/session.mjs';

function actionRequest(token, body) {
  return new Request('http://localhost/api/action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `korsa_session=${token}`,
    },
    body: JSON.stringify(body),
  });
}

async function post(token, body) {
  const response = await actionHandler(actionRequest(token, body));
  const data = await response.json();
  return { response, data };
}

test('action mewajibkan version, menolak race, dan mengarsipkan hasil', async () => {
  const { token } = await createSession({
    username: 'integration-admin',
    role: 'admin',
    meja: null,
  });

  const missingVersion = await post(token, { type: 'set-vt-mode', mode: 'light' });
  assert.equal(missingVersion.response.status, 400);
  assert.match(missingVersion.data.error, /version/i);

  const concurrent = await Promise.all([
    post(token, { type: 'set-vt-mode', mode: 'light', version: 0 }),
    post(token, { type: 'set-ratio', ratio: 'square', version: 0 }),
  ]);
  assert.deepEqual(
    concurrent.map(result => result.response.status).sort((a, b) => a - b),
    [200, 409],
  );

  let version = concurrent.find(result => result.response.status === 200).data.state.version;
  let result = await post(token, {
    type: 'load-match',
    table: 1,
    tables: [1, 2],
    match: 'P1',
    pool: 'A',
    phase: 'PENYISIHAN',
    teamA: 'BIODEX',
    teamB: 'AMONIAK',
    version,
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  version = result.data.state.version;

  for (let index = 0; index < 7; index++) {
    const aWins = index < 4;
    result = await post(token, {
      type: 'set-category',
      table: index % 2 === 0 ? 1 : 2,
      index,
      sets: aWins
        ? [{ a: 15, b: 10 }, { a: 15, b: 11 }]
        : [{ a: 10, b: 15 }, { a: 11, b: 15 }],
      version,
    });
    assert.equal(result.response.status, 200);
    version = result.data.state.version;
    assert.deepEqual(
      result.data.state.tables[0].categories[index],
      result.data.state.tables[1].categories[index],
      'hasil kategori tersinkron di pasangan lapangan',
    );

    if (index === 0) {
      const logCount = result.data.state.tables[0].logs.length;
      const duplicate = await post(token, {
        type: 'set-category',
        table: 1,
        index,
        sets: [{ a: 15, b: 10 }, { a: 15, b: 11 }],
        version,
      });
      assert.equal(duplicate.response.status, 200);
      assert.equal(duplicate.data.state.version, version);
      assert.equal(duplicate.data.state.tables[0].logs.length, logCount);
      assert.equal(duplicate.data.result.unchanged, true);

      const expandPair = await post(token, {
        type: 'load-match',
        table: 1,
        tables: [1, 2],
        match: 'P1',
        pool: 'A',
        phase: 'PENYISIHAN',
        teamA: 'BIODEX',
        teamB: 'AMONIAK',
        version,
      });
      assert.equal(expandPair.response.status, 200);
      assert.equal(expandPair.data.state.tables[0].categories[0].winner, 'A');
      assert.equal(expandPair.data.state.tables[1].categories[0].winner, 'A');
      version = expandPair.data.state.version;
    }
  }

  result = await post(token, { type: 'finish-match', table: 1, version });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.deepEqual(
    {
      winner: result.data.state.results.P1.winner,
      scoreA: result.data.state.results.P1.scoreA,
      scoreB: result.data.state.results.P1.scoreB,
      teamA: result.data.state.results.P1.teamA,
      teamB: result.data.state.results.P1.teamB,
    },
    { winner: 'A', scoreA: 4, scoreB: 3, teamA: 'BIODEX', teamB: 'AMONIAK' },
  );
  assert.equal(result.data.state.tables[0].logs.length, 10);
  assert.match(result.data.state.tables[0].logs[0].message, /Pertandingan selesai/);
  assert.equal(result.data.state.tables[0].logs[0].by, 'integration-admin');
  assert.equal(result.data.state.tables[1].status, 'finished');
  assert.deepEqual(result.data.state.results.P1.tables, [1, 2]);
  assert.ok(
    result.data.state.tables[0].logs.some(log => log.message.includes('15–10 · 15–11')),
    'log kategori menyimpan skor rally lengkap',
  );

  version = result.data.state.version;
  result = await post(token, { type: 'set-status', table: 2, status: 'live', version });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.state.tables[0].status, 'live');
  assert.equal(result.data.state.tables[1].status, 'live');
  assert.equal(result.data.state.tables[0].winner, null);
  assert.equal(result.data.state.results.P1, undefined);

  version = result.data.state.version;
  result = await post(token, { type: 'toggle-display', table: 2, version });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.state.tables[0].hidden, true);
  assert.equal(result.data.state.tables[1].hidden, true);

  version = result.data.state.version;
  result = await post(token, {
    type: 'load-match', table: 3, tables: [3, 4], match: 'P2', pool: 'B',
    phase: 'PENYISIHAN', teamA: 'NPK JOS', teamB: 'PRECIPALM', version,
  });
  assert.equal(result.response.status, 200);
  version = result.data.state.version;

  result = await post(token, {
    type: 'load-match', table: 2, tables: [2, 4], match: 'P15', pool: null,
    phase: 'FINAL', teamA: 'JUARA A', teamB: 'JUARA B', version,
  });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.data.state.loaded.P15, [2, 4]);
  assert.equal(result.data.state.loaded.P1, undefined);
  assert.equal(result.data.state.loaded.P2, undefined);
  assert.equal(result.data.state.tables[0].match, null, 'partner lama lapangan 1 dibersihkan');
  assert.equal(result.data.state.tables[2].match, null, 'partner lama lapangan 3 dibersihkan');
  assert.equal(result.data.state.tables[1].match, 'P15');
  assert.equal(result.data.state.tables[3].match, 'P15');

  version = result.data.state.version;
  const invalidIndex = await post(token, {
    type: 'set-category', table: 2, index: 1.5,
    sets: [{ a: 15, b: 10 }, { a: 15, b: 11 }], version,
  });
  assert.equal(invalidIndex.response.status, 400);
  assert.match(invalidIndex.data.error, /index/i);
});
