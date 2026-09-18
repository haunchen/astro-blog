import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  postPathToUrl,
  expectedLastmod,
  shouldSubmit,
  parseSitemapLastmods,
  buildIndexNowPayload,
} from './indexnow.mjs';

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

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://frankchen.tw/</loc></url>
<url><loc>https://frankchen.tw/my-post/</loc><lastmod>2026-09-18T00:00:00.000Z</lastmod></url>
<url><loc>https://frankchen.tw/other-post/</loc><lastmod>2026-09-01T00:00:00.000Z</lastmod></url>
</urlset>`;

test('parseSitemapLastmods：取出每個網址的 lastmod', () => {
  const map = parseSitemapLastmods(SITEMAP_XML);
  assert.equal(map.get('https://frankchen.tw/my-post/'), '2026-09-18T00:00:00.000Z');
  assert.equal(map.get('https://frankchen.tw/other-post/'), '2026-09-01T00:00:00.000Z');
});

// 沒有 lastmod 的節點要拿得到 null 而不是 undefined——呼叫端拿 undefined 分不出
// 「這個網址不在 sitemap 裡」與「在但沒有 lastmod」。
test('parseSitemapLastmods：缺 lastmod 的節點回 null', () => {
  assert.equal(parseSitemapLastmods(SITEMAP_XML).get('https://frankchen.tw/'), null);
});

test('parseSitemapLastmods：不存在的網址回 undefined', () => {
  assert.equal(parseSitemapLastmods(SITEMAP_XML).get('https://frankchen.tw/nope/'), undefined);
});

// fast-xml-parser 對單一節點不給陣列而給物件，不處理的話首篇文章上線那天會整個解析不到。
test('parseSitemapLastmods：只有一個 url 節點時仍解析得出', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://frankchen.tw/only/</loc><lastmod>2026-09-18T00:00:00.000Z</lastmod></url>
</urlset>`;
  assert.equal(parseSitemapLastmods(xml).get('https://frankchen.tw/only/'), '2026-09-18T00:00:00.000Z');
});

test('parseSitemapLastmods：空 urlset 回空 Map', () => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>';
  assert.equal(parseSitemapLastmods(xml).size, 0);
});

test('buildIndexNowPayload：keyLocation 指向站台根目錄的 key 檔', () => {
  const payload = buildIndexNowPayload({
    host: 'frankchen.tw',
    key: 'a7f3c9e2b8d4416fa0c5e7d92b1f6403',
    urls: ['https://frankchen.tw/my-post/'],
  });
  assert.deepEqual(payload, {
    host: 'frankchen.tw',
    key: 'a7f3c9e2b8d4416fa0c5e7d92b1f6403',
    keyLocation: 'https://frankchen.tw/a7f3c9e2b8d4416fa0c5e7d92b1f6403.txt',
    urlList: ['https://frankchen.tw/my-post/'],
  });
});
