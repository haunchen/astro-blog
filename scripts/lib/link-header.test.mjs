import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLinkHeader } from './link-header.mjs';

test('parseLinkHeader：單一 link-value 取出 target 與 rel', () => {
  const links = parseLinkHeader('</AGENTS.md>; rel="describedby"; type="text/markdown"');
  assert.deepEqual(links, [{ target: '/AGENTS.md', rel: 'describedby' }]);
});

test('parseLinkHeader：逗號分隔的多個 link-value 全部取出', () => {
  const links = parseLinkHeader(
    '</AGENTS.md>; rel="describedby"; type="text/markdown", ' +
      '</llms.txt>; rel="index"; type="text/plain", ' +
      '</rss.xml>; rel="alternate"; type="application/rss+xml"',
  );
  assert.deepEqual(links, [
    { target: '/AGENTS.md', rel: 'describedby' },
    { target: '/llms.txt', rel: 'index' },
    { target: '/rss.xml', rel: 'alternate' },
  ]);
});

test('parseLinkHeader：引號內的逗號不切開 link-value', () => {
  const links = parseLinkHeader('</a>; rel="alternate"; title="x, y", </b>; rel="index"');
  assert.deepEqual(links, [
    { target: '/a', rel: 'alternate' },
    { target: '/b', rel: 'index' },
  ]);
});

test('parseLinkHeader：角括號內的逗號不切開 link-value', () => {
  const links = parseLinkHeader('</a,b>; rel="alternate", </c>; rel="index"');
  assert.deepEqual(links, [
    { target: '/a,b', rel: 'alternate' },
    { target: '/c', rel: 'index' },
  ]);
});

test('parseLinkHeader：參數名與 rel 值一律正規化為小寫', () => {
  const links = parseLinkHeader('</a>; REL="Describedby"');
  assert.deepEqual(links, [{ target: '/a', rel: 'describedby' }]);
});

test('parseLinkHeader：rel 多值以空白分隔，展開成多筆', () => {
  const links = parseLinkHeader('</a>; rel="alternate index"');
  assert.deepEqual(links, [
    { target: '/a', rel: 'alternate' },
    { target: '/a', rel: 'index' },
  ]);
});

test('parseLinkHeader：未加引號的 rel 值一樣取得到', () => {
  const links = parseLinkHeader('</a>; rel=describedby');
  assert.deepEqual(links, [{ target: '/a', rel: 'describedby' }]);
});

test('parseLinkHeader：缺 rel 的 link-value 回報 rel 為 null 而非被略過', () => {
  const links = parseLinkHeader('</a>; type="text/markdown"');
  assert.deepEqual(links, [{ target: '/a', rel: null }]);
});

test('parseLinkHeader：同名參數重複時取第一個（RFC 8288）', () => {
  const links = parseLinkHeader('</a>; rel="index"; rel="alternate"');
  assert.deepEqual(links, [{ target: '/a', rel: 'index' }]);
});

test('parseLinkHeader：空值與缺值回傳空陣列', () => {
  assert.deepEqual(parseLinkHeader(''), []);
  assert.deepEqual(parseLinkHeader(null), []);
  assert.deepEqual(parseLinkHeader(undefined), []);
});
