import test from 'node:test';
import assert from 'node:assert/strict';

import {
  setWinner, computeMatchResult, canFinish, computeStandings,
} from '../netlify/functions/_lib/badminton.mjs';

test('menerima skor set normal dan deuce yang valid', () => {
  assert.equal(setWinner(15, 0), 'A');
  assert.equal(setWinner(16, 14), 'A');
  assert.equal(setWinner(18, 20), 'B');
});

test('menolak skor set yang belum selesai atau mustahil', () => {
  assert.equal(setWinner(15, 14), null);
  assert.equal(setWinner(20, 0), null);
  assert.equal(setWinner(14.5, 12.5), null);
});

test('best-of-three berhenti setelah dua kemenangan', () => {
  assert.deepEqual(
    computeMatchResult([{ a: 15, b: 8 }, { a: 15, b: 10 }]),
    { winner: 'A', scoreSet: '2-0', gamesA: 2, gamesB: 0, valid: true },
  );
  assert.equal(computeMatchResult([
    { a: 15, b: 8 }, { a: 8, b: 15 }, { a: 15, b: 10 }, { a: 15, b: 10 },
  ]).valid, false);
  assert.equal(computeMatchResult([
    { a: 15, b: 8 }, { a: 15, b: 10 }, { a: 15, b: 10 },
  ]).valid, false);
});

test('panjang match result harus dua atau tiga set', () => {
  assert.equal(computeMatchResult([{ a: 15, b: 10 }]).reason, 'invalid-length');
  assert.equal(computeMatchResult([
    { a: 15, b: 10 }, { a: 10, b: 15 },
    { a: 15, b: 10 }, { a: 10, b: 15 },
  ]).reason, 'invalid-length');
});

test('penyisihan wajib menyelesaikan seluruh kategori', () => {
  const categories = [
    { winner: 'A' }, { winner: 'A' }, { winner: 'A' }, { winner: 'A' },
    { winner: null }, { winner: null }, { winner: null },
  ];
  assert.equal(canFinish({ status: 'live', pool: 'A', categories }).reason, 'incomplete');
  categories[4].winner = 'B';
  categories[5].winner = 'B';
  categories[6].winner = 'B';
  assert.equal(canFinish({ status: 'live', pool: 'A', categories }).ok, true);
});

test('babak gugur selesai setelah empat kemenangan', () => {
  const categories = [
    { winner: 'A' }, { winner: 'A' }, { winner: 'A' },
    { winner: null }, { winner: null }, { winner: null }, { winner: null },
  ];
  assert.equal(canFinish({ status: 'live', pool: null, categories }).reason, 'not-clinched');
  categories[3].winner = 'A';
  assert.equal(canFinish({ status: 'live', pool: null, categories }).ok, true);
});

test('klasemen server menghitung hasil pertandingan pool dengan benar', () => {
  const teams = ['BIODEX', 'AMONIAK'];
  const matches = [
    { teamA: 'BIODEX', teamB: 'AMONIAK', scoreA: 15, scoreB: 12, winner: 'A' },
    { teamA: 'BIODEX', teamB: 'AMONIAK', scoreA: 12, scoreB: 15, winner: 'B' },
  ];

  const standings = computeStandings(teams, matches);
  assert.equal(standings.BIODEX.main, 2);
  assert.equal(standings.BIODEX.menang, 1);
  assert.equal(standings.BIODEX.kalah, 1);
  assert.equal(standings.BIODEX.poin, 3);
  assert.equal(standings.BIODEX.partaiMenang, 27);
  assert.equal(standings.BIODEX.partaiKalah, 27);
  assert.equal(standings.AMONIAK.menang, 1);
  assert.equal(standings.AMONIAK.poin, 3);
});
