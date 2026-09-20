import test from 'node:test';
import assert from 'node:assert/strict';

import { computeStandingsFromState } from '../public/js/standings.js';

test('klasemen membaca arsip hasil, bukan meja yang dipakai ulang', () => {
  const state = {
    loaded: { P1: 1, P3: 1 },
    tables: [{
      id: 1,
      match: 'P3',
      status: 'finished',
      teamA: 'NPK KAKAO',
      teamB: 'NITREA',
      scoreA: 4,
      scoreB: 3,
      winner: 'A',
    }],
    results: {
      P1: {
        match: 'P1', teamA: 'BIODEX', teamB: 'AMONIAK',
        scoreA: 4, scoreB: 3, winner: 'A',
      },
      P3: {
        match: 'P3', teamA: 'NPK KAKAO', teamB: 'NITREA',
        scoreA: 4, scoreB: 3, winner: 'A',
      },
    },
  };

  const standings = computeStandingsFromState(state);
  const biodex = standings.A.find(team => team.name === 'BIODEX');
  const kakao = standings.A.find(team => team.name === 'NPK KAKAO');
  assert.equal(biodex.main, 1);
  assert.equal(kakao.main, 1);
  assert.equal(standings.A.reduce((sum, team) => sum + team.main, 0), 4);
});

test('head-to-head didahulukan saat poin sama', () => {
  const state = {
    results: {
      P1: { teamA: 'BIODEX', teamB: 'AMONIAK', scoreA: 4, scoreB: 3, winner: 'A' },
      P3: { teamA: 'NPK KAKAO', teamB: 'NITREA', scoreA: 7, scoreB: 0, winner: 'A' },
      P5: { teamA: 'BIODEX', teamB: 'NPK KAKAO', scoreA: 0, scoreB: 7, winner: 'B' },
      P8: { teamA: 'AMONIAK', teamB: 'NITREA', scoreA: 7, scoreB: 0, winner: 'A' },
    },
  };

  const standings = computeStandingsFromState(state).A;
  const biodex = standings.findIndex(team => team.name === 'BIODEX');
  const amoniak = standings.findIndex(team => team.name === 'AMONIAK');
  assert.ok(biodex < amoniak, 'BIODEX menang head-to-head atas AMONIAK');
});
