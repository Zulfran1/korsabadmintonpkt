import test from 'node:test';
import assert from 'node:assert/strict';

import { canModifyTable, ROLE } from '../netlify/functions/_lib/auth.mjs';
import { getAccounts } from '../netlify/functions/auth.mjs';

test('admin dapat mengubah semua meja', () => {
  assert.equal(canModifyTable({ role: ROLE.ADMIN, meja: null }, 4), true);
});

test('operator hanya dapat mengubah meja yang ditugaskan', () => {
  const operator = { role: ROLE.OPERATOR, meja: 2 };
  assert.equal(canModifyTable(operator, 2), true);
  assert.equal(canModifyTable(operator, 1), false);
  assert.equal(canModifyTable(null, 2), false);
});

test('auth fail closed ketika env admin belum di-set', () => {
  const prevUser = process.env.ADMIN_USERNAME;
  const prevHash = process.env.ADMIN_PASSWORD_HASH;
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD_HASH;

  try {
    const accounts = getAccounts();
    const admin = accounts.find(account => account.role === 'admin');
    assert.equal(admin, undefined, 'akun admin hard-coded tidak boleh tersedia');
  } finally {
    if (prevUser) process.env.ADMIN_USERNAME = prevUser;
    if (prevHash) process.env.ADMIN_PASSWORD_HASH = prevHash;
  }
});
