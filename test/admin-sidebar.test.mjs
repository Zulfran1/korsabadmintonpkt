import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bindAdminSidebar } from '../public/js/admin-sidebar.js';

test('sidebar admin hanya memiliki satu listener toggle dan overlay mobile dapat diklik', async () => {
  const [admin, init, css] = await Promise.all([
    readFile(new URL('../public/js/admin.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/js/admin-init.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/css/korsa.css', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(admin, /getElementById\('toggle-sidebar'\).*addEventListener/);
  assert.match(init, /bindAdminSidebar\(\)/);
  assert.match(css, /\.admin-layout\[data-sidebar="closed"\] \.sidebar[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.admin-layout\[data-sidebar="open"\]::after[\s\S]*?pointer-events:\s*auto/);
  assert.match(css, /\.admin-layout\[data-sidebar="open"\],\s*\.admin-layout\[data-sidebar="closed"\]\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 808px\)[\s\S]*?\.admin-topbar\s*\{[\s\S]*?display:\s*grid/);
  assert.match(css, /\.admin-topbar__tools\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
});

test('sidebar drawer dimulai tertutup pada layar mobile', () => {
  const layout = { dataset: { sidebar: 'open' } };
  const toggle = {
    dataset: {},
    addEventListener() {},
    setAttribute() {},
  };
  const doc = {
    defaultView: { matchMedia: () => ({ matches: true }) },
    getElementById(id) {
      return id === 'admin-layout' ? layout : id === 'toggle-sidebar' ? toggle : null;
    },
    addEventListener() {},
  };

  assert.equal(bindAdminSidebar(doc), true);
  assert.equal(layout.dataset.sidebar, 'closed');
});

test('klik toggle benar-benar mengubah state sidebar dan aria', () => {
  const handlers = {};
  const layout = { dataset: { sidebar: 'open' } };
  const toggle = {
    dataset: {},
    title: '',
    attrs: {},
    addEventListener(type, handler) { handlers[type] = handler; },
    setAttribute(name, value) { this.attrs[name] = value; },
  };
  const doc = {
    defaultView: { matchMedia: () => ({ matches: false }) },
    getElementById(id) {
      return id === 'admin-layout' ? layout : id === 'toggle-sidebar' ? toggle : null;
    },
    addEventListener() {},
  };

  assert.equal(bindAdminSidebar(doc), true);
  assert.equal(bindAdminSidebar(doc), false, 'binding kedua harus diabaikan');
  assert.equal(toggle.attrs['aria-expanded'], 'true');

  handlers.click({ preventDefault() {}, stopPropagation() {} });
  assert.equal(layout.dataset.sidebar, 'closed');
  assert.equal(toggle.attrs['aria-expanded'], 'false');
  assert.equal(toggle.title, 'Buka sidebar');

  handlers.click({ preventDefault() {}, stopPropagation() {} });
  assert.equal(layout.dataset.sidebar, 'open');
  assert.equal(toggle.attrs['aria-expanded'], 'true');
});
