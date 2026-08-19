import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toYamlFrontmatter, buildImageUrlMap, rewriteImagePaths } from './md-export.mjs';

test('toYamlFrontmatter：字串以 JSON 逃逸輸出，全形冒號不破壞 YAML', () => {
  const yaml = toYamlFrontmatter({
    title: 'n8n x Telegram Bot：從 BotFather 到互動指令',
    description: '含「引號」與 : 冒號的描述',
  });
  assert.equal(
    yaml,
    '---\n' +
      'title: "n8n x Telegram Bot：從 BotFather 到互動指令"\n' +
      'description: "含「引號」與 : 冒號的描述"\n' +
      '---',
  );
});

test('toYamlFrontmatter：Date 輸出為純日期，陣列輸出為 flow sequence', () => {
  const yaml = toYamlFrontmatter({
    date: new Date('2026-01-04T00:00:00Z'),
    tags: ['n8n', 'Telegram'],
  });
  assert.equal(yaml, '---\ndate: 2026-01-04\ntags: ["n8n", "Telegram"]\n---');
});

test('toYamlFrontmatter：布林輸出不帶引號的 YAML 布林純量', () => {
  // vault-post.mjs 的 draft 欄位靠這條：`draft: "false"` 在 YAML 裡是字串、真值為 true，
  // 一旦寫成帶引號的形式，草稿會整批上站而現有驗證腳本都抓不到。
  assert.equal(toYamlFrontmatter({ draft: false }), '---\ndraft: false\n---');
  assert.equal(toYamlFrontmatter({ draft: true }), '---\ndraft: true\n---');
});

test('toYamlFrontmatter：undefined 欄位整行略過，空陣列仍輸出', () => {
  const yaml = toYamlFrontmatter({ title: 'a', updated: undefined, tags: [] });
  assert.equal(yaml, '---\ntitle: "a"\ntags: []\n---');
});

test('buildImageUrlMap：從 img src 取出檔名主幹對應的建置網址', () => {
  const html =
    '<p><img src="/_astro/botfather-official-page.C7-xNNd-_Z2bLlVd.webp" alt="a"></p>' +
    '<p><img src="/_astro/create-bot-flow.BueJL9Xk_o7PA.webp" alt="b"></p>';
  const map = buildImageUrlMap(html);
  assert.equal(map.get('botfather-official-page'), '/_astro/botfather-official-page.C7-xNNd-_Z2bLlVd.webp');
  assert.equal(map.get('create-bot-flow'), '/_astro/create-bot-flow.BueJL9Xk_o7PA.webp');
  assert.equal(map.size, 2);
});

test('buildImageUrlMap：同一主幹有多個變體時取第一個出現的', () => {
  const html =
    '<img src="/_astro/cover.DVAoR-xQ_1aYFIQ.webp" srcset="/_astro/cover.DVAoR-xQ_ZzzRAt.webp 400w">';
  const map = buildImageUrlMap(html);
  assert.equal(map.get('cover'), '/_astro/cover.DVAoR-xQ_1aYFIQ.webp');
  assert.equal(map.size, 1);
});

// ASTRO_ASSET_RE 的副檔名清單有六種，但站上現有內文圖全是 webp——所以清單裡另外五種
// 從來沒被執行過，寫錯了也不會有人知道。這條把它們一次釘住：任一種被誤刪（或 jpe?g 的
// 選擇性 e 被改壞），對應的圖就會靜默落到「對照表缺項」而讓 build 失敗，而失敗訊息
// 只會說「找不到對應的建置產物」，看不出根因是副檔名沒被 regex 認得。
test('buildImageUrlMap：webp 以外的副檔名同樣認得', () => {
  const html = [
    '<img src="/_astro/a.Hash1234_x.png">',
    '<img src="/_astro/b.Hash1234_x.jpg">',
    '<img src="/_astro/c.Hash1234_x.jpeg">',
    '<img src="/_astro/d.Hash1234_x.avif">',
    '<img src="/_astro/e.Hash1234_x.gif">',
    '<img src="/_astro/f.Hash1234_x.svg">',
  ].join('');
  const map = buildImageUrlMap(html);
  assert.deepEqual(
    [...map.entries()],
    [
      ['a', '/_astro/a.Hash1234_x.png'],
      ['b', '/_astro/b.Hash1234_x.jpg'],
      ['c', '/_astro/c.Hash1234_x.jpeg'],
      ['d', '/_astro/d.Hash1234_x.avif'],
      ['e', '/_astro/e.Hash1234_x.gif'],
      ['f', '/_astro/f.Hash1234_x.svg'],
    ],
  );
});

test('rewriteImagePaths：相對路徑換成絕對網址，其餘內容不動', () => {
  const map = new Map([['step-one', '/_astro/step-one.AbCdEfGh_1x2y3z.webp']]);
  const body = '前言\n\n![步驟一](./images/step-one.webp)\n\n結語 https://example.com/x.webp';
  assert.equal(
    rewriteImagePaths(body, map, 'https://frankchen.tw'),
    '前言\n\n![步驟一](https://frankchen.tw/_astro/step-one.AbCdEfGh_1x2y3z.webp)\n\n結語 https://example.com/x.webp',
  );
});

test('rewriteImagePaths：對照表缺項時拋錯而非默默留下壞路徑', () => {
  assert.throws(
    () => rewriteImagePaths('![x](./images/missing.webp)', new Map(), 'https://frankchen.tw'),
    /missing/,
  );
});

// 帶子目錄的引用是本模組已知的邊界：RELATIVE_IMAGE_RE 會連斜線一起收進 stem（`sub/x`），
// 而 ASTRO_ASSET_RE 的主幹刻意不含斜線，兩邊永遠對不上。結果是 build 當場失敗
// （fail-fast，不會出壞產物），這條把「失敗」這個行為釘住——真要支援子目錄的話，
// 這條會紅，提醒改的人 stem 規則兩邊都要動，而不是只改其中一邊就以為好了。
test('rewriteImagePaths：帶子目錄的引用永遠對不上對照表，拋錯而非產生壞網址', () => {
  const map = new Map([['x', '/_astro/x.AbCdEfGh_1x2y3z.webp']]);
  assert.throws(
    () => rewriteImagePaths('![x](./images/sub/x.webp)', map, 'https://frankchen.tw'),
    /sub\/x/,
  );
});
