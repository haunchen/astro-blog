import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapCategory, toIsoDate, makeDescription } from './frontmatter.mjs';

test('mapCategory：nicename 直接對應、uncategorized → n8n', () => {
  assert.equal(mapCategory('n8n'), 'n8n');
  assert.equal(mapCategory('raspberry-pi'), 'raspberry-pi');
  assert.equal(mapCategory('uncategorized'), 'n8n');
  assert.equal(mapCategory(''), 'n8n');
});

test('toIsoDate：pubDate → YYYY-MM-DD', () => {
  assert.equal(toIsoDate('Wed, 28 May 2025 02:22:20 +0000'), '2025-05-28');
});

test('makeDescription：≤160 原樣', () => {
  const d = makeDescription('短摘要', '<p>內文</p>');
  assert.equal(d, '短摘要');
});

test('makeDescription：>160 句號截斷補…且 ≤160', () => {
  const long = '第一句結束。' + '第二句很長'.repeat(40) + '。';
  const d = makeDescription(long, '');
  assert.ok(d.length <= 160, `len=${d.length}`);
  assert.ok(d.endsWith('…'));
});

test('makeDescription：空 excerpt 取內文首段前 150 字純文字', () => {
  const html = '<h2>標題</h2><p>這是第一段內文，' + '字'.repeat(200) + '</p>';
  const d = makeDescription('', html);
  assert.ok(d.length <= 160);
  assert.ok(d.startsWith('這是第一段內文'));
});
