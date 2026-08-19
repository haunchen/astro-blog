import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapCategory,
  mapDraft,
  toWebpName,
  toDate,
  collectImageRefs,
  rewriteImageSyntax,
  transformPost,
  renderPostFile,
} from './vault-post.mjs';

test('mapCategory：同一概念的中英文寫法映射到同一個 slug', () => {
  assert.equal(mapCategory('工具與應用'), 'tools');
  assert.equal(mapCategory('tools'), 'tools');
  assert.equal(mapCategory('架站與部署'), 'devops');
  assert.equal(mapCategory('devops'), 'devops');
  assert.equal(mapCategory('Raspberry Pi'), 'raspberry-pi');
  assert.equal(mapCategory('raspberry-pi'), 'raspberry-pi');
});

test('mapCategory：大小寫與前後空白不影響比對', () => {
  assert.equal(mapCategory('  DevOps  '), 'devops');
  assert.equal(mapCategory('RASPBERRY PI'), 'raspberry-pi');
});

test('mapCategory：硬體維護對應到 2026-08-19 新增的 hardware', () => {
  assert.equal(mapCategory('硬體維護'), 'hardware');
});

test('mapCategory：認不得的值與非字串一律回 null', () => {
  assert.equal(mapCategory('醫療知識'), null);
  assert.equal(mapCategory(undefined), null);
  assert.equal(mapCategory(42), null);
});

test('mapDraft：draft/ready 映射到布林，published 與未知值回 null', () => {
  assert.equal(mapDraft('draft'), true);
  assert.equal(mapDraft('ready'), false);
  assert.equal(mapDraft('published'), null);
  assert.equal(mapDraft(undefined), null);
});

test('toWebpName：取檔名主幹並換成 .webp', () => {
  assert.equal(toWebpName('attachments/cover_foo.png'), 'cover_foo.webp');
  assert.equal(toWebpName('a/b/c/photo.JPG'), 'photo.webp');
  assert.equal(toWebpName('already.webp'), 'already.webp');
});

test('toDate：吃 Date 與字串兩種寫法，無效值回 null', () => {
  assert.equal(toDate(new Date('2025-11-24T00:00:00Z')).toISOString().slice(0, 10), '2025-11-24');
  assert.equal(toDate('2026-03-06').toISOString().slice(0, 10), '2026-03-06');
  assert.equal(toDate(''), null);
  assert.equal(toDate('not-a-date'), null);
  assert.equal(toDate(undefined), null);
});

test('collectImageRefs：wikilink 的尺寸參數不算路徑，alt 為空', () => {
  const refs = collectImageRefs('文字\n![[30-Areas/x/attachments/shot.png|700]]\n更多文字');
  assert.equal(refs.length, 1);
  assert.deepEqual(refs[0], {
    kind: 'wikilink',
    src: '30-Areas/x/attachments/shot.png',
    alt: '',
    destName: 'shot.webp',
  });
});

test('collectImageRefs：標準 markdown 語法保留 alt', () => {
  const refs = collectImageRefs('![電池型號標示](attachments/battery.jpg)');
  assert.equal(refs.length, 1);
  assert.equal(refs[0].kind, 'markdown');
  assert.equal(refs[0].alt, '電池型號標示');
  assert.equal(refs[0].destName, 'battery.webp');
});

test('collectImageRefs：外部圖片不收——vault 裡沒有這個檔，複製不到', () => {
  assert.deepEqual(collectImageRefs('![a](https://example.com/x.png)'), []);
  assert.deepEqual(collectImageRefs('![[//cdn.example.com/y.png]]'), []);
});

test('rewriteImageSyntax：兩種語法都轉成 repo 慣例的相對路徑', () => {
  const body = '![[long/path/a.png|500]]\n\n![說明](attachments/b.jpg)';
  assert.equal(rewriteImageSyntax(body), '![](./images/a.webp)\n\n![說明](./images/b.webp)');
});

test('rewriteImageSyntax：外部網址原樣不動', () => {
  const body = '![a](https://example.com/x.png)';
  assert.equal(rewriteImageSyntax(body), body);
});

/** 一份會通過所有檢查的 vault frontmatter，各測試只覆寫要驗的那一欄。 */
function validData(overrides = {}) {
  return {
    type: 'tutorial',
    slug: 'ups-battery-buying-guide',
    title: 'UPS 電池選購指南',
    description: '挑選 UPS 電池要看的規格與常見地雷',
    category: '硬體維護',
    cover_image: 'attachments/cover_ups.png',
    created: new Date('2026-03-06T00:00:00Z'),
    updated: new Date('2026-08-16T00:00:00Z'),
    tags: ['ups', 'hardware'],
    content_status: 'draft',
    ...overrides,
  };
}

test('transformPost：合規的 draft 轉出完整 frontmatter 與 draft: true', () => {
  const r = transformPost(validData(), '正文');
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.frontmatter, {
    title: 'UPS 電池選購指南',
    date: new Date('2026-03-06T00:00:00Z'),
    updated: new Date('2026-08-16T00:00:00Z'),
    description: '挑選 UPS 電池要看的規格與常見地雷',
    category: 'hardware',
    tags: ['ups', 'hardware'],
    cover: './images/cover.webp',
    draft: true,
  });
  assert.deepEqual(r.cover, { src: 'attachments/cover_ups.png', destName: 'cover.webp' });
});

test('transformPost：ready 轉成 draft: false', () => {
  const r = transformPost(validData({ content_status: 'ready' }), '正文');
  assert.equal(r.status, 'ok');
  assert.equal(r.frontmatter.draft, false);
});

test('transformPost：updated 與 created 同日時不輸出 updated', () => {
  const same = new Date('2026-03-06T00:00:00Z');
  const r = transformPost(validData({ updated: same }), '正文');
  assert.equal('updated' in r.frontmatter, false);
});

test('transformPost：published 判為 skipped 而不是不合規', () => {
  const r = transformPost(validData({ content_status: 'published' }), '正文');
  assert.equal(r.status, 'skipped');
  assert.deepEqual(r.issues, []);
});

test('transformPost：非 tutorial 直接 skipped', () => {
  const r = transformPost(validData({ type: 'resource' }), '正文');
  assert.equal(r.status, 'skipped');
});

test('transformPost：缺 cover_image 判為 blocked', () => {
  const r = transformPost(validData({ cover_image: '' }), '正文');
  assert.equal(r.status, 'blocked');
  assert.ok(r.issues.some((i) => i.includes('cover_image')));
});

test('transformPost：分類無對應判為 blocked 並帶出原值', () => {
  const r = transformPost(validData({ category: '醫療知識' }), '正文');
  assert.equal(r.status, 'blocked');
  assert.ok(r.issues.some((i) => i.includes('醫療知識')));
});

test('transformPost：超長 title/description 各自 blocked，兩條一次報完', () => {
  const r = transformPost(
    validData({ title: 'a'.repeat(61), description: 'b'.repeat(161) }),
    '正文',
  );
  assert.equal(r.status, 'blocked');
  assert.equal(r.issues.length, 2);
});

test('transformPost：blocked 時不輸出 frontmatter，避免半成品被誤用', () => {
  const r = transformPost(validData({ cover_image: '' }), '正文');
  assert.equal(r.frontmatter, undefined);
  assert.equal(r.body, undefined);
});

test('transformPost：缺 alt 的圖列 WARN 但不擋落地', () => {
  const r = transformPost(validData(), '![[x/a.png|700]]\n![有alt](b.png)');
  assert.equal(r.status, 'ok');
  assert.ok(r.warnings.some((w) => w.includes('1 張圖沒有 alt')));
});

test('transformPost：previous_slugs 有值時提醒補 301', () => {
  const r = transformPost(validData({ previous_slugs: ['old-slug'] }), '正文');
  assert.equal(r.status, 'ok');
  assert.ok(r.warnings.some((w) => w.includes('_redirects')));
});

test('renderPostFile：frontmatter 與正文之間只留一個換行', () => {
  const out = renderPostFile({ title: '標題：測試', draft: false }, '\n\n## 前言\n內文');
  assert.equal(out, '---\ntitle: "標題：測試"\ndraft: false\n---\n## 前言\n內文');
});

test('renderPostFile：draft 是 YAML 布林而非字串——寫成字串會讓草稿整批上站', () => {
  const out = renderPostFile({ draft: true }, '內文');
  assert.ok(out.includes('draft: true'));
  assert.ok(!out.includes('draft: "true"'));
});
