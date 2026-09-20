import test from 'node:test';
import assert from 'node:assert/strict';

import { groupTablesForDisplay } from '../public/js/display.js';

const categories = winner => [
  {
    name: 'Kategori 1',
    sets: winner ? [{ a: 15, b: 10 }, { a: 15, b: 11 }] : [],
    winner,
    scoreSet: winner ? '2-0' : null,
  },
  { name: 'Kategori 2', sets: [], winner: null, scoreSet: null },
];

test('videotron menggabungkan pasangan lapangan menjadi satu pertandingan', () => {
  const tables = [
    { id: 1, match: 'P1', status: 'live', teamA: 'BIODEX', teamB: 'AMONIAK', categories: categories('A') },
    { id: 2, match: 'P1', status: 'live', teamA: 'BIODEX', teamB: 'AMONIAK', categories: categories(null) },
    { id: 3, match: 'P2', status: 'waiting', teamA: 'NPK JOS', teamB: 'PRECIPALM', categories: categories(null) },
    { id: 4, match: 'P2', status: 'waiting', teamA: 'NPK JOS', teamB: 'PRECIPALM', categories: categories(null) },
  ];
  const fixtures = {
    P1: { mejas: [1, 2] },
    P2: { mejas: [3, 4] },
  };

  const result = groupTablesForDisplay(tables, fixtures);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].courtIds, [1, 2]);
  assert.equal(result[0].scoreA, 1);
  assert.deepEqual(result[1].courtIds, [3, 4]);
});
