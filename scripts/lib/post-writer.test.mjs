import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteImageRefs, buildFrontmatter } from './post-writer.mjs';

test('rewriteImageRefs：URL → ./images/img-N.webp', () => {
  const md = '![憑證](https://x/1.png)\n\n文字\n\n![圖二](https://x/2.png)';
  const map = { 'https://x/1.png': 'img-1.webp', 'https://x/2.png': 'img-2.webp' };
  const out = rewriteImageRefs(md, map);
  assert.match(out, /!\[憑證\]\(\.\/images\/img-1\.webp\)/);
  assert.match(out, /!\[圖二\]\(\.\/images\/img-2\.webp\)/);
});

test('rewriteImageRefs：找不到對應的 URL 保留並加 TODO 註解', () => {
  const md = '![x](https://x/miss.png)';
  const out = rewriteImageRefs(md, {});
  assert.match(out, /https:\/\/x\/miss\.png/);
  assert.match(out, /TODO/);
});

test('buildFrontmatter：產出合法 YAML 區塊', () => {
  const fm = buildFrontmatter({
    title: '如何使用 Certbot',
    date: '2025-05-28',
    description: '摘要',
    category: 'devops',
    tags: ['SSL', 'Nginx'],
    cover: './images/cover.webp',
  });
  assert.match(fm, /^---\n/);
  assert.match(fm, /title: "如何使用 Certbot"/);
  assert.match(fm, /date: 2025-05-28/);
  assert.match(fm, /category: "devops"/);
  assert.match(fm, /tags: \["SSL", "Nginx"\]/);
  assert.match(fm, /cover: "\.\/images\/cover\.webp"/);
  assert.match(fm, /draft: false/);
  assert.match(fm, /\n---\n$/);
});
