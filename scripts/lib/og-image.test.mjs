import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import subsetFont from 'subset-font';
import { renderOgImage, ogImagePath, ogRouteSlug } from './og-image.mjs';

// 測試字型刻意用 node_modules 裡版本固定的 Inter，不用 src/assets/og-fonts/：
// 那個目錄被 gitignore、由 build 前的 subset-fonts 產生，CI 先跑 npm test 時還不存在。
const INTER = 'node_modules/@fontsource/inter/files/inter-latin-700-normal.woff';

const INPUT = { title: 'Cache busting for OG images', category: 'devops', siteName: 'Engineer Notes' };

async function fontsFrom(source, chars) {
  const data = await subsetFont(source, chars, { targetFormat: 'woff' });
  return [{ name: 'Inter', data, weight: 700, style: 'normal' }];
}

test('renderOgImage：同一輸入連渲兩次，雜湊與位元組完全相同', async () => {
  const source = await readFile(INTER);
  const fonts = await fontsFrom(source, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .');
  const first = await renderOgImage({ ...INPUT, fonts });
  const second = await renderOgImage({ ...INPUT, fonts });
  assert.equal(first.hash, second.hash);
  assert.ok(first.bytes.equals(second.bytes));
  assert.match(first.hash, /^[0-9a-f]{8}$/);
});

// 這條守的是驗收條件「新增一篇文章不得改變既有文章的 OG 圖檔名」：新文章會讓
// subset-fonts 重算出內容不同的字型檔，而輸出必須不受影響。
test('renderOgImage：字型檔位元組不同但字形相同時，雜湊不變', async () => {
  const source = await readFile(INTER);
  const small = await fontsFrom(source, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .');
  const large = await fontsFrom(source, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .0123456789!?@#$%&*');
  assert.notEqual(small[0].data.length, large[0].data.length);
  const fromSmall = await renderOgImage({ ...INPUT, fonts: small });
  const fromLarge = await renderOgImage({ ...INPUT, fonts: large });
  assert.equal(fromSmall.hash, fromLarge.hash);
});

test('renderOgImage：標題改一個字，雜湊必變', async () => {
  const source = await readFile(INTER);
  const fonts = await fontsFrom(source, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .');
  const before = await renderOgImage({ ...INPUT, fonts });
  const after = await renderOgImage({ ...INPUT, title: `${INPUT.title}.`, fonts });
  assert.notEqual(before.hash, after.hash);
});

test('ogImagePath / ogRouteSlug：雜湊插在副檔名之前', () => {
  assert.equal(ogRouteSlug('my-post', 'deadbeef'), 'my-post.deadbeef');
  assert.equal(ogImagePath('my-post', 'deadbeef'), '/og/my-post.deadbeef.png');
});
