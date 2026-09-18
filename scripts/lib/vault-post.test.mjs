import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapCategory,
  mapDraft,
  toWebpName,
  toDate,
  collectImageRefs,
  rewriteImageSyntax,
  stripLeadingH1,
  transformPost,
  renderPostFile,
  parsePublishAt,
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

/** 剛好落在 120–160 區間的描述——湊字數不是為了好看，是因為下限現在會擋。 */
const VALID_DESCRIPTION =
  '挑選 UPS 電池要看的規格與常見地雷：容量怎麼換算成實際撐機時間、原廠與副廠電池差在哪、換電池前該量哪幾個數字、買回來之後多久要重測一次，還有哪些規格表上的數字其實看了也沒用。這篇把選購到驗收的順序一次講完，讓你不必在停電當下才發現買錯。';

/** 一份會通過所有檢查的 vault frontmatter，各測試只覆寫要驗的那一欄。 */
function validData(overrides = {}) {
  return {
    type: 'tutorial',
    slug: 'ups-battery-buying-guide',
    title: 'UPS 電池選購指南',
    description: VALID_DESCRIPTION,
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
    description: VALID_DESCRIPTION,
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

// vault 的 updated 是「最後一次動這則筆記」，repo 的 updated 是「已上線的文章被改過」。
// 兩者同名不同義，原本被原樣搬過來——UPS 系列兩篇因此帶著寫作歷程上站（2026-09-18 修）。
// 這三條把分界線釘住：只有落地即發布的稿子才輸出 updated。
test('transformPost：落地成草稿時不輸出 updated（寫作歷程不是修訂紀錄）', () => {
  const r = transformPost(validData({ content_status: 'draft' }), '正文');
  assert.equal('updated' in r.frontmatter, false);
});

test('transformPost：排程落地不輸出 updated，即使來源是 ready', () => {
  const r = transformPost(validData({ content_status: 'ready' }), '正文', {
    publishAt: new Date('2026-09-24T00:00:00Z'),
  });
  assert.equal(r.frontmatter.draft, true);
  assert.equal('updated' in r.frontmatter, false);
});

test('transformPost：落地即發布時輸出 updated，但與 created 同日不輸出', () => {
  const ready = transformPost(validData({ content_status: 'ready' }), '正文');
  assert.deepEqual(ready.frontmatter.updated, new Date('2026-08-16T00:00:00Z'));

  const same = new Date('2026-03-06T00:00:00Z');
  const sameDay = transformPost(validData({ content_status: 'ready', updated: same }), '正文');
  assert.equal('updated' in sameDay.frontmatter, false);
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

test('transformPost：description 太短也 blocked——下限漏掉會一路過到 CI 才炸', () => {
  const r = transformPost(validData({ description: 'b'.repeat(119) }), '正文');
  assert.equal(r.status, 'blocked');
  assert.ok(r.issues.some((i) => i.includes('119 字')));
});

test('transformPost：剝掉正文開頭的 H1，避免與 layout 的標題湊成兩個 <h1>', () => {
  const r = transformPost(validData(), '# UPS 電池選購指南\n\n## 前言\n內文');
  assert.equal(r.status, 'ok');
  assert.equal(r.body, '\n## 前言\n內文');
});

test('transformPost：正文中段的 H1 不動——那是作者的層級選擇，不是重複標題', () => {
  const r = transformPost(validData(), '## 前言\n\n# 中段標題\n內文');
  assert.equal(r.body, '## 前言\n\n# 中段標題\n內文');
});

test('stripLeadingH1：# 開頭但沒空白的不是標題，原樣保留', () => {
  assert.equal(stripLeadingH1('#hashtag\n內文'), '#hashtag\n內文');
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

test('parsePublishAt：合法日期回 UTC 午夜的 Date', () => {
  const r = parsePublishAt('2026-09-01', '2026-08-24');
  assert.equal(r.error, null);
  assert.equal(r.date.toISOString(), '2026-09-01T00:00:00.000Z');
});

test('parsePublishAt：今天可以排（cron 當天就會翻）', () => {
  assert.equal(parsePublishAt('2026-08-24', '2026-08-24').error, null);
});

test('parsePublishAt：過去日期擋掉，訊息指向「不要加這個參數」', () => {
  const r = parsePublishAt('2026-08-23', '2026-08-24');
  assert.equal(r.date, null);
  assert.ok(r.error.includes('過去的日期'));
});

test('parsePublishAt：只收 YYYY-MM-DD，寬鬆寫法一律拒收', () => {
  for (const bad of ['2026/09/01', '9/1', '2026-9-1', '2026-09-01T00:00:00Z', '', null]) {
    assert.ok(parsePublishAt(bad, '2026-08-24').error, `應拒收：${bad}`);
  }
});

test('parsePublishAt：格式對但日期不存在（2 月 30 日）要擋', () => {
  assert.ok(parsePublishAt('2026-02-30', '2026-01-01').error);
});

test('transformPost：不帶 publishAt 時 frontmatter 沒有這個欄位', () => {
  const r = transformPost(validData(), '正文');
  assert.equal(r.frontmatter.publishAt, undefined);
});

test('transformPost：帶 publishAt 時輸出該欄位且 draft 為 true', () => {
  const at = new Date('2026-09-01T00:00:00Z');
  const r = transformPost(validData(), '正文', { publishAt: at });
  assert.equal(r.status, 'ok');
  assert.equal(r.frontmatter.publishAt, at);
  assert.equal(r.frontmatter.draft, true);
});

test('transformPost：ready 稿排程時強制 draft: true 並留 warning', () => {
  // schema 的 refine 要求 publishAt 與 draft: true 成對；ready 映成 draft: false，
  // 照抄會產出一篇 build 期就被擋下的文章。
  const r = transformPost(validData({ content_status: 'ready' }), '正文', {
    publishAt: new Date('2026-09-01T00:00:00Z'),
  });
  assert.equal(r.frontmatter.draft, true);
  assert.ok(r.warnings.some((w) => w.includes('draft: true')));
});

test('transformPost：draft 稿排程時不會多留一條 ready 的 warning', () => {
  const r = transformPost(validData(), '正文', { publishAt: new Date('2026-09-01T00:00:00Z') });
  assert.ok(!r.warnings.some((w) => w.includes('content_status 是 ready')));
});

test('transformPost：publishAt 非 Date 時忽略，不會產出壞欄位', () => {
  const r = transformPost(validData(), '正文', { publishAt: '2026-09-01' });
  assert.equal(r.frontmatter.publishAt, undefined);
  assert.equal(r.frontmatter.draft, true); // 來自 content_status: draft，不是被排程翻的
});

test('renderPostFile：publishAt 序列化成裸日期，schema 的 z.coerce.date 才收得下', () => {
  const out = renderPostFile(
    { draft: true, publishAt: new Date('2026-09-01T00:00:00Z') },
    '內文',
  );
  assert.ok(out.includes('publishAt: 2026-09-01'));
  assert.ok(!out.includes('publishAt: "2026-09-01"'));
});
