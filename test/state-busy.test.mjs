import test from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultState, getState, isTableBusy, replaceState,
} from '../public/js/state.js';

test('lapangan placeholder dari state lama tidak dianggap sibuk', () => {
  const table = getState().tables[0];
  delete table.match;
  table.teamA = 'TIM A';
  table.teamB = 'TIM B';
  table.status = 'waiting';
  table.scoreA = 0;
  table.scoreB = 0;
  table.categories = defaultState().tables[0].categories;
  assert.equal(isTableBusy(1), false);
});

test('placeholder kosong berstatus live dari state rusak tidak memblokir jadwal', () => {
  const table = getState().tables[0];
  table.match = null;
  table.teamA = 'TIM A';
  table.teamB = 'TIM B';
  table.status = 'live';
  table.scoreA = 0;
  table.scoreB = 0;
  table.categories = defaultState().tables[0].categories;

  assert.equal(isTableBusy(1), false);
});

test('lapangan dengan jadwal, skor, atau rally tetap dianggap sibuk', () => {
  const table = getState().tables[0];
  table.match = 'P1';
  assert.equal(isTableBusy(1), true);

  table.match = null;
  table.scoreA = 1;
  assert.equal(isTableBusy(1), true);

  table.scoreA = 0;
  table.categories[0].sets = [{ a: 15, b: 10 }];
  assert.equal(isTableBusy(1), true);
});

test('recovery konflik menerima versi server yang lebih rendah setelah restart', () => {
  const high = defaultState();
  high.version = 50;
  high.updatedAt = 500;
  replaceState(high, { force: true });
  assert.equal(getState().version, 50);

  const restarted = defaultState();
  restarted.version = 12;
  restarted.updatedAt = 120;
  replaceState(restarted);
  assert.equal(getState().version, 50, 'poll biasa tetap menolak state lama');

  replaceState(restarted, { force: true });
  assert.equal(getState().version, 12, 'recovery konflik mengikuti versi server');
});
