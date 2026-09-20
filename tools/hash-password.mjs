#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   HASH PASSWORD — generate bcrypt hash untuk env var Netlify
   ═══════════════════════════════════════════════════════════════════════════

   Cara pakai:
     node tools/hash-password.mjs "password-rahasia"
     node tools/hash-password.mjs              (mode interaktif)

   Output: hash bcrypt cost 12 yang tinggal copy ke env var.
   ═══════════════════════════════════════════════════════════════════════════ */

import bcrypt from 'bcryptjs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const COST = 12;

async function main() {
  let password = process.argv[2];

  if (!password) {
    const rl = readline.createInterface({ input, output });
    password = await rl.question('Password: ');
    rl.close();
    if (!password) {
      console.error('✗ Password tidak boleh kosong');
      process.exit(1);
    }
  }

  if (password.length < 8) {
    console.error('✗ Password minimal 8 karakter');
    process.exit(1);
  }

  console.log('\n⏳ Menghitung bcrypt hash (cost ' + COST + ')…');
  const t0 = Date.now();
  const hash = await bcrypt.hash(password, COST);
  const ms = Date.now() - t0;

  console.log('\n✓ Hash selesai dalam ' + ms + 'ms\n');
  console.log('─'.repeat(72));
  console.log(hash);
  console.log('─'.repeat(72));
  console.log('\nCopy baris di atas ke env var Netlify (ADMIN_PASSWORD_HASH, dsb).');
  console.log('Contoh:');
  console.log('  ADMIN_PASSWORD_HASH=' + hash);
  console.log('');
}

main().catch(err => {
  console.error('✗ Error:', err.message);
  process.exit(1);
});