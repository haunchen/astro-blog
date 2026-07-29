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
