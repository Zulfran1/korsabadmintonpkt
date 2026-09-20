import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const ignored = new Set(['node_modules', '.netlify', '.git']);

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (ignored.has(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

const files = filesIn(root);
const scripts = files.filter(path => ['.js', '.mjs'].includes(extname(path)));
const errors = [];

for (const path of scripts) {
  const checked = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (checked.status !== 0) {
    errors.push(`${relative(root, path)}: ${checked.stderr.trim() || 'syntax error'}`);
  }
}

for (const htmlPath of files.filter(path => extname(path) === '.html')) {
  const html = readFileSync(htmlPath, 'utf8');
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+)["']/gi)]
    .map(match => match[1])
    .filter(ref => !/^(?:https?:|data:|#)/i.test(ref));
  for (const ref of refs) {
    const cleanRef = ref.split(/[?#]/)[0];
    const target = resolve(htmlPath, '..', cleanRef);
    if (!existsSync(target)) errors.push(`${relative(root, htmlPath)}: referensi tidak ditemukan: ${ref}`);
  }
}

if (errors.length) {
  console.error(`Pemeriksaan project gagal (${errors.length} masalah):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Project check OK: ${scripts.length} script dan referensi HTML valid.`);
