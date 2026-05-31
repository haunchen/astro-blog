import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectImageUrls, planImageNames } from './images.mjs';

test('collectImageUrls：抓出內文所有 img src 並去重', () => {
  const md = '![a](https://x/1.png)\n\n![b](https://x/2.png)\n\n![c](https://x/1.png)';
  const urls = collectImageUrls(md);
  assert.deepEqual(urls, ['https://x/1.png', 'https://x/2.png']);
});

test('planImageNames：cover + 內文圖編號，皆 .webp', () => {
  const plan = planImageNames(
    'https://x/cover.jpg',
    ['https://x/1.png', 'https://x/2.gif']
  );
  assert.equal(plan.cover.localName, 'cover.webp');
  assert.equal(plan.content[0].localName, 'img-1.webp');
  assert.equal(plan.content[1].localName, 'img-2.webp');
  assert.equal(plan.content[0].url, 'https://x/1.png');
});
