import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pagePathToMdPath } from './md-path.mjs';

test('pagePathToMdPath：首頁映射到 /index.md', () => {
  assert.equal(pagePathToMdPath('/'), '/index.md');
});

test('pagePathToMdPath：單層頁面去掉結尾斜線加 .md', () => {
  assert.equal(pagePathToMdPath('/about/'), '/about.md');
  assert.equal(pagePathToMdPath('/articles/'), '/articles.md');
});

test('pagePathToMdPath：深層頁面保留目錄結構', () => {
  assert.equal(pagePathToMdPath('/category/n8n/'), '/category/n8n.md');
  assert.equal(pagePathToMdPath('/tag/raspberry-pi/'), '/tag/raspberry-pi.md');
});

// 本站頁面一律帶結尾斜線，不帶斜線即代表這不是頁面。回 null 讓呼叫端退回原行為，
// 而不是硬湊一個 md 路徑出來——那會讓中介層對每個字型檔都去撈一次不存在的資產。
test('pagePathToMdPath：不帶結尾斜線的路徑回 null', () => {
  assert.equal(pagePathToMdPath('/_astro/index.a1b2c3.js'), null);
  assert.equal(pagePathToMdPath('/fonts/inter-latin-400-normal.1a37bf8f.woff2'), null);
  assert.equal(pagePathToMdPath('/404.html'), null);
});

// 直接請求 md 本身不該再被映射一次（會變成 /about.md.md）。
test('pagePathToMdPath：已經是 .md 的路徑回 null', () => {
  assert.equal(pagePathToMdPath('/about.md'), null);
  assert.equal(pagePathToMdPath('/index.md'), null);
});

test('pagePathToMdPath：非絕對路徑與非字串回 null', () => {
  assert.equal(pagePathToMdPath('about/'), null);
  assert.equal(pagePathToMdPath(''), null);
  assert.equal(pagePathToMdPath(undefined), null);
});
