import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postPathToUrl, expectedLastmod, shouldSubmit } from './indexnow.mjs';

const ORIGIN = 'https://frankchen.tw';

test('postPathToUrl：目錄型文章換算成帶結尾斜線的正規網址', () => {
  assert.equal(
    postPathToUrl('src/content/posts/my-post/index.md', ORIGIN),
    'https://frankchen.tw/my-post/',
  );
});

// astro.config.mjs 的 POST_LASTMOD 兩種形狀都認，這裡跟著認，否則哪天新增一篇平鋪
// 檔就會靜靜地不送。
test('postPathToUrl：平鋪型文章同樣換算得出', () => {
  assert.equal(
    postPathToUrl('src/content/posts/my-post.md', ORIGIN),
    'https://frankchen.tw/my-post/',
  );
});

// git 在 Windows 上仍回正斜線，但本機直接呼叫時可能拿到反斜線路徑。
test('postPathToUrl：反斜線路徑正常換算', () => {
  assert.equal(
    postPathToUrl('src\\content\\posts\\my-post\\index.md', ORIGIN),
    'https://frankchen.tw/my-post/',
  );
});

test('postPathToUrl：非文章路徑與非 md 檔回 null', () => {
  assert.equal(postPathToUrl('src/pages/about.astro', ORIGIN), null);
  assert.equal(postPathToUrl('src/content/posts/my-post/cover.png', ORIGIN), null);
  assert.equal(postPathToUrl('docs/specs/index-submission.md', ORIGIN), null);
});

// 規則必須與 astro.config.mjs 的 POST_LASTMOD 一致：updated 優先，缺席才用 date。
test('expectedLastmod：有 updated 時以 updated 為準', () => {
  assert.equal(
    expectedLastmod({ date: new Date('2026-09-01'), updated: new Date('2026-09-18') }),
    '2026-09-18T00:00:00.000Z',
  );
});

test('expectedLastmod：沒有 updated 時落回 date', () => {
  assert.equal(expectedLastmod({ date: new Date('2026-09-01') }), '2026-09-01T00:00:00.000Z');
});

// gray-matter 對裸日期給 Date、對加引號的值給字串，兩種都要吃。
test('expectedLastmod：字串日期同樣解析得出', () => {
  assert.equal(expectedLastmod({ date: '2026-09-01' }), '2026-09-01T00:00:00.000Z');
});

test('expectedLastmod：無法解析時回 null', () => {
  assert.equal(expectedLastmod({}), null);
  assert.equal(expectedLastmod({ date: 'not-a-date' }), null);
});

test('shouldSubmit：新增的非草稿文章要送', () => {
  assert.equal(shouldSubmit(null, { date: new Date('2026-09-18') }), true);
});

test('shouldSubmit：草稿翻牌要送', () => {
  assert.equal(
    shouldSubmit({ draft: true, date: new Date('2026-09-18') }, { date: new Date('2026-09-18') }),
    true,
  );
});

test('shouldSubmit：updated 改變要送', () => {
  assert.equal(
    shouldSubmit(
      { date: new Date('2026-09-01') },
      { date: new Date('2026-09-01'), updated: new Date('2026-09-18') },
    ),
    true,
  );
});

// 錯字與排版修正本來就不該動 updated，也就不該告訴搜尋引擎內容變了。
test('shouldSubmit：只改內文而 updated 沒動的不送', () => {
  const fm = { date: new Date('2026-09-01'), updated: new Date('2026-09-10') };
  assert.equal(shouldSubmit({ ...fm }, { ...fm }), false);
});

// 草稿的網址根本不存在，送出去等於叫搜尋引擎去抓 404。
test('shouldSubmit：仍是草稿的一律不送', () => {
  assert.equal(shouldSubmit(null, { draft: true, date: new Date('2026-09-18') }), false);
  assert.equal(
    shouldSubmit({ draft: true, date: new Date('2026-09-18') }, { draft: true, updated: new Date('2026-09-18') }),
    false,
  );
});

test('shouldSubmit：被刪除的文章不送', () => {
  assert.equal(shouldSubmit({ date: new Date('2026-09-01') }, null), false);
});

// Date 與字串混用時不可因型別差異誤判成「有改動」。
test('shouldSubmit：updated 值等價但型別不同時不算改動', () => {
  assert.equal(
    shouldSubmit({ updated: '2026-09-10', date: '2026-09-01' }, { updated: new Date('2026-09-10'), date: '2026-09-01' }),
    false,
  );
});
