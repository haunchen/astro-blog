#!/usr/bin/env node
/**
 * 建置後靜態 SEO 驗證。
 *
 * 為什麼不用線上工具（Screaming Frog / Search Console 等）：那些要嘛要人工跑、
 * 要嘛要等 Google 重新爬取才看得到結果，沒辦法卡在 PR 階段擋下退化。這支腳本
 * 直接讀 dist/ 的靜態輸出做斷言，能在幾秒內於 CI 跑完、對每個頁面逐一檢查。
 *
 * 只用純 Node + 專案既有依賴（glob / fast-xml-parser），刻意不用 DOM 解析套件
 * （jsdom 等）——SEO 要看的都是固定格式的 meta/link/script 標籤，
 * regex 抓取夠用且不必多背一個重量級依賴。
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';
import { XMLParser } from 'fast-xml-parser';
import matter from 'gray-matter';

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = path.join(PROJECT_ROOT, 'dist');
const SITE_HOST = 'frankchen.tw';
const SITE_ORIGIN = `https://${SITE_HOST}`;

// AdSense 的賣家授權宣告（docs/specs/monetization.md R1）。ads.txt 用 pub- 前綴，
// 元素屬性 data-ad-client 用 ca-pub- 前綴，是同一個帳號的兩種寫法，不能互換。
//
// 與 src/utils/ads.ts 的 ADSENSE_CLIENT 同源（同一個 publisher ID，只是前綴不同）。
// .mjs 無法 import .ts 的常數（此腳本跑在 dist/ 建置後、獨立於 Astro 的型別系統之外），
// 所以兩邊各存一份，改一邊要記得改兩邊。
const ADS_TXT_PUBLISHER_ID = 'pub-5544842849576289';
// 元素屬性上的寫法（data-ad-client）。用它當「這一頁有沒有廣告」的判準，
// 比對打包後的 JS 檔名穩定得多——檔名帶內容雜湊，每次改動都會變。
const ADSENSE_CLIENT_ATTR = 'ca-pub-5544842849576289';

const quiet = process.argv.includes('--quiet');

if (!existsSync(DIST)) {
  console.error(`找不到 ${DIST}，請先執行 npm run build`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 小工具：從原始 HTML 字串抓標籤與屬性，不依賴 DOM 解析器
// ---------------------------------------------------------------------------

function getAttr(tag, name) {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"|${name}\\s*=\\s*'([^']*)'`, 'i');
  const m = tag.match(re);
  if (!m) return undefined;
  return m[1] !== undefined ? m[1] : m[2];
}

function findTags(html, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  return html.match(re) || [];
}

// 把要當成字面值嵌進 RegExp 的字串跳脫。用在頁面路徑上：標籤 slug 直接來自內容作者，
// 只要有人寫出 `C++` 或 `n8n (自架)` 這種標籤，未跳脫的 `+`／`(` 就會讓 new RegExp
// 丟 SyntaxError，整支 verify-seo 當場崩掉——而錯誤訊息完全看不出是哪個標籤造成的。
// `.` 這類「不會崩但會比對過寬」的字元同樣要跳脫（現有的 `Node.js` 標籤就是）。
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// HTML 註解裡的文字（例如原始碼註解說明「astro-seo 會輸出 <meta name="robots">」）
// 會被上面的 regex 誤判成真的標籤，所以所有頁面內容一律先去除註解再掃描。
function stripHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function findMetaByAttr(html, attrName, attrValue) {
  return findTags(html, 'meta').filter(
    (tag) => (getAttr(tag, attrName) ?? '').toLowerCase() === attrValue.toLowerCase(),
  );
}

// 為什麼 head 標籤要檢查「恰好一個」而不是「至少一個」：重複的標籤會讓爬蟲取到
// 不確定的那一個，最糟的是兩個彼此矛盾。實際踩過——astro-seo 自己會輸出一個
// <meta name="robots">，我們又手寫了一個，同一頁同時出現 index 與 noindex，
// 後來改用 robotsExtras 才解決；當時的腳本只檢查存在性，這種頁面照樣 PASS。
// 回傳 trim 後的屬性值；有任何問題則記錄 failure 並回傳 null。
function requireSingleTag(failures, pathname, tags, label, valueAttr = 'content') {
  if (tags.length === 0) {
    failures.push({ page: pathname, reason: `缺少 ${label}` });
    return null;
  }
  if (tags.length > 1) {
    // 只說「找到 2 個」沒辦法判斷嚴不嚴重（兩個相同 vs 一個 index 一個 noindex
    // 是完全不同的事），所以把實際內容列出來。
    const values = tags.map((tag) => (getAttr(tag, valueAttr) ?? `（無 ${valueAttr}）`).trim() || '（空值）');
    failures.push({ page: pathname, reason: `找到 ${tags.length} 個 ${label}：${values.join(' / ')}` });
    return null;
  }
  const value = (getAttr(tags[0], valueAttr) ?? '').trim();
  if (!value) {
    failures.push({ page: pathname, reason: `${label} 為空` });
    return null;
  }
  return value;
}

function findJsonLdBlocks(html) {
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(html))) {
    blocks.push(m[1]);
  }
  return blocks;
}

// schema.org @type 可能是字串或陣列
function hasType(obj, type) {
  if (!obj || typeof obj !== 'object') return false;
  const t = obj['@type'];
  if (Array.isArray(t)) return t.includes(type);
  return t === type;
}

function findByType(objs, type) {
  return objs.find((o) => hasType(o, type));
}

// ---------------------------------------------------------------------------
// 蒐集 dist 內所有 HTML 頁面
// ---------------------------------------------------------------------------

const htmlFiles = globSync('**/*.html', { cwd: DIST }).sort();

function fileToPathname(relFile) {
  const p = '/' + relFile.replace(/\\/g, '/');
  if (p === '/index.html') return '/';
  if (p.endsWith('/index.html')) return p.slice(0, -'index.html'.length);
  if (p === '/404.html') return '/404';
  return p.replace(/\.html$/, '');
}

const pages = htmlFiles.map((relFile) => ({
  relFile,
  pathname: fileToPathname(relFile),
  html: stripHtmlComments(readFileSync(path.join(DIST, relFile), 'utf8')),
}));

// ---------------------------------------------------------------------------
// 文章來源：id 推導與草稿狀態
//
// id 推導規則與 astro.config.mjs 的 POST_LASTMOD 同一套，確保這裡認定的文章集合跟
// sitemap lastmod 邏輯一致，不會各自走鐘。全檔只推導這一次——底下的 articlePathnames
// 與 articleSlugs 都由這份結果衍生，slug 規則要改（例如支援巢狀目錄）只改這裡。
//
// 草稿判定要讀來源 frontmatter：dist 裡看不出「這篇是刻意不產 md，還是漏產了」。
// ---------------------------------------------------------------------------

const sourcePosts = globSync('src/content/posts/**/*.md', { cwd: PROJECT_ROOT }).map((file) => {
  const id = file
    .replace(/\\/g, '/')
    .replace(/^src\/content\/posts\//, '')
    .replace(/\/index\.md$/, '')
    .replace(/\.md$/, '');
  const { data } = matter(readFileSync(path.join(PROJECT_ROOT, file), 'utf8'));
  return { id, draft: data.draft === true };
});

// 刻意不濾掉草稿：這個集合的用途是「把 dist 的頁面分類成文章／非文章」，而草稿本來就
// 不會出現在 dist，濾不濾的實際結果相同。不濾的話，萬一哪天草稿真的外流到 dist，
// 它會被當文章驗（少了廣告版位就報 FAIL），比被當成非文章頁報「不應出現廣告」易讀。
const articlePathnames = new Set(sourcePosts.map(({ id }) => `/${id}/`));

// ---------------------------------------------------------------------------
// Markdown 變體（agent-markdown spec）：產物與來源的草稿狀態
// ---------------------------------------------------------------------------

// dist 裡的 md 分三類，各有各的契約，混在一起驗必定誤報：
//   1. 文章 md（R1/R2）：完整 frontmatter，canonical 指向 /<slug>/
//   2. 首頁 md（R6）：四欄契約，canonical 指向 /
//   3. 頁面 md（R10）：四欄契約，canonical 指向該頁自己的網址
// 另有 AGENTS.md，它根本沒有 frontmatter，四類都不適用。
//
// 這個分類曾經是「文章以外都例外」的黑名單（NON_ARTICLE_MD），在頁面 md 出現後不再夠用：
// 黑名單漏一項就會把它當文章驗，而失敗訊息完全看不出根因。改成以來源為準的白名單——
// 文章的集合直接來自 src/content/posts/，不靠 dist 的檔名去猜。
const HOME_MD_SLUG = 'index';
const AGENTS_MD_SLUG = 'AGENTS';

const allMdInDist = new Map(
  globSync('**/*.md', { cwd: DIST })
    .sort()
    .map((relFile) => [
      relFile.replace(/\\/g, '/').replace(/\.md$/, ''),
      readFileSync(path.join(DIST, relFile), 'utf8'),
    ]),
);

const articleSlugs = new Set(sourcePosts.filter((p) => !p.draft).map((p) => p.id));

const mdBySlug = new Map([...allMdInDist].filter(([slug]) => articleSlugs.has(slug)));

const pageMdBySlug = new Map(
  [...allMdInDist].filter(
    ([slug]) => !articleSlugs.has(slug) && slug !== HOME_MD_SLUG && slug !== AGENTS_MD_SLUG,
  ),
);

const ORIGIN_RE_SOURCE = SITE_ORIGIN.replace(/\./g, '\\.');
const MD_ASSET_RE = new RegExp(`${ORIGIN_RE_SOURCE}(/_astro/[^\\s)）"']+)`, 'g');
const MD_DECLARED_RE = new RegExp(`${ORIGIN_RE_SOURCE}/([^\\s)）]+)\\.md`, 'g');
const MD_REQUIRED_KEYS = ['title', 'description', 'date', 'category', 'tags', 'canonical', 'image'];

// ---------------------------------------------------------------------------
// 檢查項目：每項回傳 { failures: [{ page, reason }] }
// ---------------------------------------------------------------------------

const results = [];

function check(name, fn) {
  const failures = [];
  fn(failures);
  results.push({ name, failures });
}

check('每頁恰有一個 <title>', (failures) => {
  for (const { pathname, html } of pages) {
    const titles = findTags(html, 'title');
    if (titles.length !== 1) {
      failures.push({ page: pathname, reason: `找到 ${titles.length} 個 <title>` });
    } else {
      const text = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
      if (!text) failures.push({ page: pathname, reason: '<title> 內容為空' });
    }
  }
});

check('每頁恰有一個非空 <meta name="description">', (failures) => {
  for (const { pathname, html } of pages) {
    requireSingleTag(failures, pathname, findMetaByAttr(html, 'name', 'description'), 'meta description');
  }
});

// SERP 版位是有限的：title 約 60 字元、description 約 160 字元之後會被截斷，
// 太短則浪費版位、也給不了點擊理由。這兩項在稽核工具上是最大宗的失分來源，
// 但 zod schema 只擋文章 title 上限、pre-commit 只擋文章 description，
// 手寫的靜態頁與動態產生的列表頁完全沒有防線——補在這裡才是全站覆蓋。
// noindex 的頁面（404）不進 SERP，豁免。
const TITLE_RANGE = [30, 60];
const DESC_RANGE = [120, 160];

// 刻意用 some 而非「唯一那個」：爬蟲的實際行為是多個 robots 指示取最嚴格的，
// 任一個說 noindex 就不會被索引。和下面的唯一性檢查不衝突——真的出現重複標籤時，
// 唯一性那項會獨立報 FAIL，這裡只負責決定長度檢查要不要豁免這一頁（從嚴豁免，
// 避免同一個問題在兩項規則裡重複噴訊息）。
function isNoindex(html) {
  const tags = findMetaByAttr(html, 'name', 'robots');
  return tags.some((t) => (getAttr(t, 'content') ?? '').includes('noindex'));
}

// HTML 實體會讓字元數失真（&amp; 是 5 個字元但實際只有 1 個）
function decodeEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

check(`可索引頁的 <title> 長度介於 ${TITLE_RANGE[0]}–${TITLE_RANGE[1]} 字元`, (failures) => {
  for (const { pathname, html } of pages) {
    if (isNoindex(html)) continue;
    const text = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    if (!text) continue; // 缺 title 由上一項檢查負責回報
    const len = decodeEntities(text).length;
    if (len < TITLE_RANGE[0] || len > TITLE_RANGE[1]) {
      failures.push({ page: pathname, reason: `title 長度 ${len}（需 ${TITLE_RANGE[0]}–${TITLE_RANGE[1]}）` });
    }
  }
});

check(`可索引頁的 meta description 長度介於 ${DESC_RANGE[0]}–${DESC_RANGE[1]} 字元`, (failures) => {
  for (const { pathname, html } of pages) {
    if (isNoindex(html)) continue;
    const tags = findMetaByAttr(html, 'name', 'description');
    if (tags.length !== 1) continue; // 缺少或重複由上面的唯一性檢查負責回報
    const content = (getAttr(tags[0], 'content') ?? '').trim();
    if (!content) continue;
    const len = decodeEntities(content).length;
    if (len < DESC_RANGE[0] || len > DESC_RANGE[1]) {
      failures.push({ page: pathname, reason: `description 長度 ${len}（需 ${DESC_RANGE[0]}–${DESC_RANGE[1]}）` });
    }
  }
});

check('每頁恰有一個 <link rel="canonical">，host 為 frankchen.tw', (failures) => {
  for (const { pathname, html } of pages) {
    const tags = findTags(html, 'link').filter(
      (tag) => (getAttr(tag, 'rel') ?? '').toLowerCase() === 'canonical',
    );
    // 重複的 canonical 對搜尋引擎等同「沒有 canonical」——Google 的文件明講
    // 多個 rel=canonical 會讓它全部忽略，改用自己的判斷挑代表網址。
    const href = requireSingleTag(failures, pathname, tags, 'canonical', 'href');
    if (href === null) continue;
    let host;
    try {
      host = new URL(href).host;
    } catch {
      failures.push({ page: pathname, reason: `canonical href 不是合法 URL：${href}` });
      continue;
    }
    if (host !== SITE_HOST) {
      failures.push({ page: pathname, reason: `canonical host 為 ${host}，預期 ${SITE_HOST}` });
    }
  }
});

check('每頁恰有一個非空 <meta name="robots">', (failures) => {
  for (const { pathname, html } of pages) {
    requireSingleTag(failures, pathname, findMetaByAttr(html, 'name', 'robots'), 'meta robots');
  }
});

// og:image 一併納入唯一性檢查的理由：Open Graph 規格本身允許同一頁給多張圖
// （消費端通常取第一張），所以「多個」在語意上不算違規；但本站設計上每頁只輸出
// 一張 OG 圖，2026-07-23 實測 dist/ 的 104 頁全部都是恰好 1 個。既然實際只有一個，
// 多出來的就代表有非預期的重複來源（例如 layout 與頁面各輸出一次），該被擋下。
check('每頁恰有一個非空 og:title / og:description / og:image / og:url', (failures) => {
  const props = ['og:title', 'og:description', 'og:image', 'og:url'];
  for (const { pathname, html } of pages) {
    for (const prop of props) {
      requireSingleTag(failures, pathname, findMetaByAttr(html, 'property', prop), prop);
    }
  }
});

// OG 圖網址帶內容雜湊（pre-launch-infra.md R4、R12），三個消費端（這裡的 og:image、
// BlogPosting JSON-LD 的 image、.md 變體 frontmatter 的 image）必須算出同一個網址。
// md 那側已由「.md 變體 frontmatter 的 image 指向存在的檔案」涵蓋，這條補上 HTML 側。
//
// 格式與存在性兩件事都要驗：只驗存在的話，退化回固定檔名 /og/<slug>.png 時檔案照樣
// 存在（端點會產出它），快取正確性卻已經默默倒退回本 issue 修掉的狀態。
const OG_HASHED_RE = /^\/og\/(.+)\.[0-9a-f]{8}\.png$/;

check('文章頁的 og:image 為帶內容雜湊的檔名且檔案存在', (failures) => {
  for (const { pathname, html } of pages) {
    if (!articlePathnames.has(pathname)) continue;
    const value = requireSingleTag(failures, pathname, findMetaByAttr(html, 'property', 'og:image'), 'og:image');
    if (value === null) continue;
    let imagePath;
    try {
      imagePath = decodeURIComponent(new URL(value, `${SITE_ORIGIN}/`).pathname);
    } catch {
      failures.push({ page: pathname, reason: `og:image 不是合法 URL：${value}` });
      continue;
    }
    if (!OG_HASHED_RE.test(imagePath)) {
      failures.push({ page: pathname, reason: `og:image 應為 /og/<slug>.<8 碼雜湊>.png，實際為 ${imagePath}` });
      continue;
    }
    if (!existsSync(path.join(DIST, imagePath.replace(/^\//, '')))) {
      failures.push({ page: pathname, reason: `og:image 指向不存在的檔案：${imagePath}` });
    }
  }
});

check('每頁恰有一個非空 twitter:card', (failures) => {
  for (const { pathname, html } of pages) {
    requireSingleTag(failures, pathname, findMetaByAttr(html, 'name', 'twitter:card'), 'twitter:card');
  }
});

check('每頁恰有一個 <h1>', (failures) => {
  for (const { pathname, html } of pages) {
    const h1s = findTags(html, 'h1');
    if (h1s.length !== 1) {
      failures.push({ page: pathname, reason: `找到 ${h1s.length} 個 <h1>` });
    }
  }
});

// 每頁的 JSON-LD 區塊都先在這裡 parse 一次，後面文章頁檢查重複使用同一份結果
const pageJsonLd = new Map();

check('每頁至少一個 JSON-LD，且皆可 JSON.parse', (failures) => {
  for (const page of pages) {
    const blocks = findJsonLdBlocks(page.html);
    if (blocks.length === 0) {
      failures.push({ page: page.pathname, reason: '缺少 application/ld+json' });
      pageJsonLd.set(page.pathname, []);
      continue;
    }
    // 解析失敗的區塊記進 failures（本檢查已因此紅燈）後略過，解析成功的照樣註冊——
    // 下游檢查因此仍能對得起來的那幾塊報出各自的問題，一次紅燈看到全部而非擠牙膏。
    const parsed = [];
    for (const block of blocks) {
      try {
        parsed.push(JSON.parse(block));
      } catch (err) {
        failures.push({ page: page.pathname, reason: `JSON-LD 解析失敗：${err.message}` });
      }
    }
    pageJsonLd.set(page.pathname, parsed);
  }
});

check('文章頁需有 BlogPosting 與 BreadcrumbList JSON-LD', (failures) => {
  for (const page of pages) {
    if (!articlePathnames.has(page.pathname)) continue;
    const jsonLd = pageJsonLd.get(page.pathname) ?? [];
    const blogPosting = findByType(jsonLd, 'BlogPosting');
    const breadcrumb = findByType(jsonLd, 'BreadcrumbList');
    if (!blogPosting) failures.push({ page: page.pathname, reason: '缺少 BlogPosting JSON-LD' });
    if (!breadcrumb) failures.push({ page: page.pathname, reason: '缺少 BreadcrumbList JSON-LD' });
    if (blogPosting) {
      if (!blogPosting.publisher?.name) {
        failures.push({ page: page.pathname, reason: 'BlogPosting 缺少 publisher.name' });
      }
      if (!blogPosting.publisher?.logo) {
        failures.push({ page: page.pathname, reason: 'BlogPosting 缺少 publisher.logo' });
      }
      // R12：OG 圖網址只能有一個來源，BlogPosting.image 與 og:image 必須完全相同。
      // 不驗這條的話，[...slug].astro 的 JSON-LD image 若被人手寫回退成固定檔名
      // `${SITE.url}/og/${post.id}.png`，這裡照樣全綠、只有線上的 JSON-LD 圖 404。
      const ogImageTag = findMetaByAttr(page.html, 'property', 'og:image')[0];
      const ogImageValue = ogImageTag ? (getAttr(ogImageTag, 'content') ?? '').trim() : undefined;
      if (!blogPosting.image) {
        failures.push({ page: page.pathname, reason: 'BlogPosting 缺少 image' });
      } else if (ogImageValue && blogPosting.image !== ogImageValue) {
        failures.push({
          page: page.pathname,
          reason: `BlogPosting.image（${blogPosting.image}）與 og:image（${ogImageValue}）不一致`,
        });
      }
    }
  }
});

// ---------------------------------------------------------------------------
// sitemap.xml
// ---------------------------------------------------------------------------

check('dist/sitemap.xml 存在、可解析、URL 皆為 https://frankchen.tw 開頭、無死連結', (failures) => {
  const sitemapPath = path.join(DIST, 'sitemap.xml');
  if (!existsSync(sitemapPath)) {
    failures.push({ page: 'sitemap.xml', reason: '檔案不存在' });
    return;
  }
  const xml = readFileSync(sitemapPath, 'utf8');
  let parsed;
  try {
    parsed = new XMLParser().parse(xml);
  } catch (err) {
    failures.push({ page: 'sitemap.xml', reason: `XML 解析失敗：${err.message}` });
    return;
  }
  const rawUrls = parsed?.urlset?.url;
  if (!rawUrls) {
    failures.push({ page: 'sitemap.xml', reason: 'urlset/url 節點不存在' });
    return;
  }
  const urls = Array.isArray(rawUrls) ? rawUrls : [rawUrls];
  if (urls.length === 0) {
    failures.push({ page: 'sitemap.xml', reason: 'sitemap 內沒有任何 URL' });
    return;
  }
  for (const entry of urls) {
    const loc = typeof entry === 'string' ? entry : entry.loc;
    if (!loc || !loc.startsWith(`${SITE_ORIGIN}/`) ) {
      failures.push({ page: 'sitemap.xml', reason: `URL 非 ${SITE_ORIGIN} 開頭：${loc}` });
      continue;
    }
    const pathname = decodeURIComponent(new URL(loc).pathname);
    const targetFile = pathname.endsWith('/')
      ? path.join(DIST, pathname, 'index.html')
      : path.join(DIST, pathname);
    if (!existsSync(targetFile)) {
      failures.push({ page: pathname, reason: `sitemap 指向不存在的檔案：${targetFile}` });
    }
  }
});

// ---------------------------------------------------------------------------
// 靜態必要檔案
// ---------------------------------------------------------------------------

check('dist/robots.txt、llms.txt、site.webmanifest 存在', (failures) => {
  for (const name of ['robots.txt', 'llms.txt', 'site.webmanifest']) {
    if (!existsSync(path.join(DIST, name))) {
      failures.push({ page: name, reason: '檔案不存在' });
    }
  }
});

// ---------------------------------------------------------------------------
// 孤兒頁檢查：對每個非首頁、非 404 的頁面，至少要被另一頁以站內連結指到
// ---------------------------------------------------------------------------

// 站內死連結是 SEO 與使用者體驗的雙重扣分，但完全靠爬線上站來抓很不可靠——
// CDN 對密集請求會重置連線、preview 部署與本地 dist 的資產雜湊也不一致，
// 兩者都會產生假的 4xx。改成在 dist 上做確定性檢查：每個站內 href 都必須
// 對應到實際輸出的檔案。同時擋下協定降級的 http:// 外連。
check('站內連結皆可解析為實際輸出的檔案，且無 http:// 協定降級', (failures) => {
  const existsInDist = (pathname) => {
    const rel = decodeURIComponent(pathname).replace(/^\//, '');
    const candidates = [rel, path.posix.join(rel, 'index.html'), `${rel.replace(/\/$/, '')}.html`];
    return candidates.some((c) => existsSync(path.join(DIST, c)));
  };

  for (const { pathname, html } of pages) {
    for (const tag of findTags(html, 'a')) {
      const href = (getAttr(tag, 'href') ?? '').trim();
      if (!href) continue;
      if (href.startsWith('http://')) {
        failures.push({ page: pathname, reason: `協定降級的連結：${href}` });
        continue;
      }
      if (!href.startsWith('/')) continue; // 外連與錨點不在此檢查範圍
      const clean = href.split('#')[0].split('?')[0];
      if (!clean || clean === '/') continue;
      if (!existsInDist(clean)) {
        failures.push({ page: pathname, reason: `站內連結指向不存在的檔案：${href}` });
      }
    }
  }
});

check('無孤兒頁（首頁、404 除外，皆至少被其他頁面連結）', (failures) => {
  const pageSet = new Map(pages.map((p) => [p.pathname, p.relFile]));
  const inbound = new Map(pages.map((p) => [p.pathname, new Set()]));

  function resolveInternalPathname(href, sourcePathname) {
    if (!href) return null;
    const trimmed = href.trim();
    if (
      trimmed === '' ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('tel:') ||
      trimmed.startsWith('javascript:')
    ) {
      return null;
    }
    let url;
    try {
      url = new URL(trimmed, SITE_ORIGIN + sourcePathname);
    } catch {
      return null;
    }
    if (url.host !== SITE_HOST) return null;
    return decodeURIComponent(url.pathname);
  }

  for (const { pathname, html } of pages) {
    const anchorTags = findTags(html, 'a');
    for (const tag of anchorTags) {
      const href = getAttr(tag, 'href');
      const target = resolveInternalPathname(href, pathname);
      if (!target || target === pathname) continue;
      if (!pageSet.has(target)) continue;
      inbound.get(target).add(pathname);
    }
  }

  for (const { pathname, relFile } of pages) {
    if (relFile === 'index.html' || relFile === '404.html') continue;
    if ((inbound.get(pathname)?.size ?? 0) === 0) {
      failures.push({ page: pathname, reason: '沒有任何其他頁面以站內連結指向此頁' });
    }
  }
});

// 這條防的是一個完全不會有錯誤訊息的失敗模式：<link rel="preload" as="image"> 與
// 實際的 <img> 對候選圖的描述不一致時，瀏覽器會先照 preload 抓一張、渲染時再依
// <img> 的 sizes 挑一次，兩次挑到不同張就等於把 LCP 圖下載兩份——頁面看起來完全
// 正常，只是變慢，比不 preload 還糟。三個呼叫端目前都從 src/utils/images.ts 取值，
// 但只要有人在某個頁面改了 sizes 而忘了另一邊，這裡就會擋下來。
check('LCP 圖 preload 的 imagesrcset/imagesizes 與對應 <img> 一致', (failures) => {
  for (const { pathname, html } of pages) {
    const preloads = findTags(html, 'link').filter(
      (tag) => getAttr(tag, 'rel') === 'preload' && getAttr(tag, 'as') === 'image',
    );
    for (const link of preloads) {
      const href = getAttr(link, 'href');
      const imgs = findTags(html, 'img');
      // 用 srcset 比對而非 src：帶 srcset 時 <img> 的 src 只是不支援 srcset 的
      // 瀏覽器的 fallback，preload 的 href 也是同樣角色，兩者本來就該相等。
      const img = imgs.find((tag) => getAttr(tag, 'src') === href);
      if (!img) {
        failures.push({ page: pathname, reason: `preload 了 ${href}，但頁面上沒有 src 相同的 <img>` });
        continue;
      }
      const pairs = [
        ['imagesrcset', 'srcset'],
        ['imagesizes', 'sizes'],
      ];
      for (const [linkAttr, imgAttr] of pairs) {
        const linkValue = getAttr(link, linkAttr) ?? '';
        const imgValue = getAttr(img, imgAttr) ?? '';
        if (linkValue !== imgValue) {
          failures.push({
            page: pathname,
            reason:
              `preload 的 ${linkAttr} 與 <img> 的 ${imgAttr} 不一致，` +
              `LCP 圖會被下載兩份\n        preload：${linkValue || '（無）'}\n        img    ：${imgValue || '（無）'}`,
          });
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Markdown 變體
// ---------------------------------------------------------------------------

check('每篇非草稿文章都有對應的 .md 變體', (failures) => {
  for (const { id, draft } of sourcePosts) {
    if (draft) continue;
    if (!mdBySlug.has(id)) failures.push({ page: `/${id}.md`, reason: '缺少 markdown 變體' });
  }
});

// 這條要用 allMdInDist（未經文章白名單過濾的全集）而不是 mdBySlug：mdBySlug 的定義是
// 「allMdInDist ∩ articleSlugs」，而 articleSlugs 本身就已經排除了草稿——對任何草稿的 id，
// mdBySlug.has(id) 恆為 false，這條檢查會變成死碼，草稿真的外流到 dist 也偵測不到。
check('草稿文章不得產出 .md 變體', (failures) => {
  for (const { id, draft } of sourcePosts) {
    if (draft && allMdInDist.has(id)) {
      failures.push({ page: `/${id}.md`, reason: '草稿不應輸出 markdown 變體' });
    }
  }
});

check('.md 變體不得殘留來源的相對圖片路徑', (failures) => {
  for (const [slug, text] of mdBySlug) {
    if (text.includes('./images/')) {
      failures.push({ page: `/${slug}.md`, reason: '仍含 ./images/ 相對路徑，agent 抓不到圖' });
    }
  }
});

// 這條是主防線：擋掉「圖片網址看起來對、實際指向沒被 emit 的檔案」這個
// 最容易復發的錯誤（改用 import.meta.glob 取 .src 就會全面觸發）。
check('.md 變體引用的建置資產都真的存在', (failures) => {
  for (const [slug, text] of mdBySlug) {
    for (const match of text.matchAll(MD_ASSET_RE)) {
      if (!existsSync(path.join(DIST, match[1]))) {
        failures.push({ page: `/${slug}.md`, reason: `引用的資產不存在：${match[1]}` });
      }
    }
  }
});

// 上面那條只掃正文，frontmatter 的 image 完全在它的視野外——而那是 md 唯一對外宣告的
// 縮圖（文章是 /og/<slug>.<hash>.png，頁面與首頁取自該頁的 og:image），與正文的圖各自獨立產生。
// 沒有這條時「md 產出了、對應的圖沒產出」是全綠的：欄位齊全檢查只看欄位在不在，
// 不看指到的東西存不存在。文章的耦合（有 md 就必有 OG 圖，兩個端點用同一份已發佈文章
// 清單與 post.id）目前成立，但成立與驗過是兩回事。
check('.md 變體 frontmatter 的 image 指向存在的檔案', (failures) => {
  const homeMd = allMdInDist.get(HOME_MD_SLUG);
  const entries = [
    ...mdBySlug,
    ...pageMdBySlug,
    ...(homeMd === undefined ? [] : [[HOME_MD_SLUG, homeMd]]),
  ];
  for (const [slug, text] of entries) {
    let image;
    try {
      image = matter(text).data.image;
    } catch {
      continue; // 解析失敗由各自的 frontmatter 檢查負責回報
    }
    if (typeof image !== 'string' || image === '') continue; // 缺欄位同上
    if (!image.startsWith(`${SITE_ORIGIN}/`)) {
      failures.push({
        page: `/${slug}.md`,
        reason: `image 應為 ${SITE_ORIGIN} 的絕對網址，實際為 ${image}`,
      });
      continue;
    }
    const rel = decodeURIComponent(new URL(image).pathname).replace(/^\//, '');
    if (!existsSync(path.join(DIST, rel))) {
      failures.push({ page: `/${slug}.md`, reason: `image 指向不存在的檔案：/${rel}` });
    }
  }
});

check('.md 變體的 frontmatter 可解析、欄位齊全且不外洩內部欄位', (failures) => {
  for (const [slug, text] of mdBySlug) {
    let data;
    try {
      ({ data } = matter(text));
    } catch (err) {
      failures.push({ page: `/${slug}.md`, reason: `frontmatter 解析失敗：${err.message}` });
      continue;
    }
    for (const key of MD_REQUIRED_KEYS) {
      if (data[key] === undefined) {
        failures.push({ page: `/${slug}.md`, reason: `frontmatter 缺少 ${key}` });
      }
    }
    if ('draft' in data) {
      failures.push({ page: `/${slug}.md`, reason: 'frontmatter 不應曝光 draft 欄位' });
    }
    const expectedCanonical = `${SITE_ORIGIN}/${slug}/`;
    if (data.canonical !== expectedCanonical) {
      failures.push({
        page: `/${slug}.md`,
        reason: `canonical 應為 ${expectedCanonical}，實際為 ${data.canonical}`,
      });
    }
  }
});

// 首頁的 md 變體：與文章 md 分開檢查，契約也不同（見 index.md.ts 檔頭）。
// 它的存在理由之一是稽核工具的 ax/markdown-response 只探首頁，所以「首頁有沒有
// md」本身就是要守住的東西，不能只靠文章那組斷言順帶覆蓋。
check('首頁有 markdown 變體且 frontmatter 正確', (failures) => {
  const text = allMdInDist.get(HOME_MD_SLUG);
  if (text === undefined) {
    failures.push({ page: '/index.md', reason: '缺少首頁 markdown 變體' });
    return;
  }
  let data;
  try {
    ({ data } = matter(text));
  } catch (err) {
    failures.push({ page: '/index.md', reason: `frontmatter 解析失敗：${err.message}` });
    return;
  }
  for (const key of ['title', 'description', 'canonical', 'image']) {
    if (data[key] === undefined) {
      failures.push({ page: '/index.md', reason: `frontmatter 缺少 ${key}` });
    }
  }
  if (data.canonical !== `${SITE_ORIGIN}/`) {
    failures.push({
      page: '/index.md',
      reason: `canonical 應為 ${SITE_ORIGIN}/，實際為 ${data.canonical}`,
    });
  }
});

check('首頁 HTML 宣告 markdown 變體', (failures) => {
  const home = pages.find((p) => p.pathname === '/');
  if (!home) {
    failures.push({ page: '/', reason: '找不到首頁 HTML' });
    return;
  }
  if (!/<link[^>]+type=["']text\/markdown["'][^>]+href=["']\/index\.md["']/.test(home.html)) {
    failures.push({
      page: '/',
      reason: '缺少 <link rel="alternate" type="text/markdown" href="/index.md">',
    });
  }
});

// AGENTS.md 是 public/ 底下的靜態檔，不經路由產生——所以它最可能的失效方式是
// 「被誤刪或改名之後沒有人發現」。稽核工具（squirrelscan ax/agents-md）只檢查它
// 非空且不是 HTML 錯誤頁，這裡照同一個口徑守住，另外釘住幾個一定要提到的取用管道：
// 少了它們，這份文件就退化成一個為了關警告而存在的空殼。
check('AGENTS.md 存在且涵蓋主要取用管道', (failures) => {
  const text = allMdInDist.get(AGENTS_MD_SLUG);
  if (text === undefined) {
    failures.push({ page: '/AGENTS.md', reason: '缺少 AGENTS.md' });
    return;
  }
  if (text.trim().length === 0) {
    failures.push({ page: '/AGENTS.md', reason: '內容為空' });
    return;
  }
  if (/^\s*<(!doctype|html)/i.test(text)) {
    failures.push({ page: '/AGENTS.md', reason: '內容是 HTML，不是 markdown' });
    return;
  }
  for (const channel of ['/llms.txt', '/index.md', '/rss.xml', '/robots.txt', 'canonical', 'Accept: text/markdown']) {
    if (!text.includes(channel)) {
      failures.push({ page: '/AGENTS.md', reason: `未提及 ${channel}` });
    }
  }
});

check('llms.txt 宣告的 .md 連結與實際產物一一對應', (failures) => {
  const llmsPath = path.join(DIST, 'llms.txt');
  if (!existsSync(llmsPath)) {
    failures.push({ page: '/llms.txt', reason: '檔案不存在' });
    return;
  }
  const llms = readFileSync(llmsPath, 'utf8');
  const declared = new Set([...llms.matchAll(MD_DECLARED_RE)].map((m) => m[1]));
  for (const slug of mdBySlug.keys()) {
    if (!declared.has(slug)) failures.push({ page: '/llms.txt', reason: `未宣告 ${slug}.md` });
  }
  for (const slug of declared) {
    if (!mdBySlug.has(slug)) {
      failures.push({ page: '/llms.txt', reason: `宣告了不存在的 ${slug}.md` });
    }
  }
});

// @astrojs/sitemap 目前只收 HTML 頁面，md 變體天然不會進去；但「天然成立」和
// 「有人驗過」是兩回事——這條是 spec S5 的明文情境，靠慣例不靠斷言的話，
// 哪天 sitemap 設定改動就會靜默失守。
check('sitemap 不得收錄 .md 變體', (failures) => {
  const sitemapPath = path.join(DIST, 'sitemap.xml');
  if (!existsSync(sitemapPath)) {
    failures.push({ page: '/sitemap.xml', reason: '檔案不存在' });
    return;
  }
  const sitemap = readFileSync(sitemapPath, 'utf8');
  for (const match of sitemap.matchAll(MD_DECLARED_RE)) {
    failures.push({ page: '/sitemap.xml', reason: `不應收錄 markdown 變體：${match[0]}` });
  }
});

// 每個 HTML 頁面都必須有對應的 md。這條是硬要求不是盡力而為：R11 的內容協商在找不到 md 時
// 會退回 HTML，缺漏因此完全靜默——協商「有回應」、頁面「看起來正常」，只有 agent 拿不到 md。
check('每個 HTML 頁面都有對應的 markdown 變體', (failures) => {
  for (const { pathname } of pages) {
    // 404 頁沒有 md 變體（noindex，且不在協商範圍內）
    if (pathname === '/404' || pathname === '/404.html') continue;
    const slug = pathname === '/' ? HOME_MD_SLUG : pathname.replace(/^\//, '').replace(/\/$/, '');
    if (!allMdInDist.has(slug)) {
      failures.push({ page: pathname, reason: `缺少對應的 ${slug}.md` });
    }
  }
});

check('頁面 markdown 變體的 frontmatter 為四欄契約且 canonical 正確', (failures) => {
  for (const [slug, text] of pageMdBySlug) {
    let data;
    try {
      ({ data } = matter(text));
    } catch (err) {
      failures.push({ page: `/${slug}.md`, reason: `frontmatter 解析失敗：${err.message}` });
      continue;
    }
    for (const key of ['title', 'description', 'canonical', 'image']) {
      if (!data[key]) failures.push({ page: `/${slug}.md`, reason: `frontmatter 缺少 ${key}` });
    }
    // 頁面不是文章，硬湊這些欄位只是為了讓同一組斷言跑得過而編造資料（見 spec D7）。
    for (const key of ['date', 'category', 'tags']) {
      if (key in data) {
        failures.push({ page: `/${slug}.md`, reason: `頁面 md 不應有文章欄位 ${key}` });
      }
    }
    // slug 直接來自 dist 的檔名，是解碼後的原始文字（例如標籤「Google Cloud」含空白、
    // 「工作流程」是中文）；但頁面實際輸出的 canonical 是瀏覽器網址，特殊字元一律
    // percent-encode（encodeURI 的規則：空白與非 ASCII 會編碼，單引號等安全字元不會）。
    // 兩邊不做同一次編碼就會逐字元比對失敗，誤判成 canonical 錯誤。
    const expectedCanonical = `${SITE_ORIGIN}/${encodeURI(slug)}/`;
    if (data.canonical !== expectedCanonical) {
      failures.push({
        page: `/${slug}.md`,
        reason: `canonical 應為 ${expectedCanonical}，實際為 ${data.canonical}`,
      });
    }
  }
});

// 轉換器與 BaseLayout 的 #main-content 結構耦合，版面改結構時抽取會靜默劣化成一份
// 只有 frontmatter 的空殼。長度下限擋不住「讀起來好不好」，但擋得住「整段沒抽到」。
check('頁面 markdown 變體有實質內容', (failures) => {
  for (const [slug, text] of pageMdBySlug) {
    const body = matter(text).content.trim();
    if (body.length < 80) {
      failures.push({ page: `/${slug}.md`, reason: `正文僅 ${body.length} 字元，疑似抽取失敗` });
    }
    if (body.includes('<div') || body.includes('</div>')) {
      failures.push({ page: `/${slug}.md`, reason: '正文殘留未轉換的 HTML 標籤' });
    }
  }
});

// 頁面 md 由整份 #main-content 轉來，麵包屑住在裡面，不剝掉就會在每份產物的最前面留下
// 一段「1. [首頁](…) /」的導覽清單——每份幾十個 token，而本功能的意義就是省 token。
// 剝除靠的是 page-md.mjs 對 Breadcrumbs.astro class 名稱的比對，那個 class 一改名，
// 麵包屑會靜默回到輸出裡（產物仍是一份合法 md，其他斷言全綠）。這條是那條耦合的守門人：
// 所有頁面版面都是「麵包屑 → H1 → 內容」，剝乾淨的唯一形狀就是正文首行為 H1。
check('頁面 markdown 變體的正文以 H1 起始（麵包屑已剝除）', (failures) => {
  for (const [slug, text] of pageMdBySlug) {
    const firstLine = matter(text).content.trim().split('\n')[0];
    if (!/^# \S/.test(firstLine)) {
      failures.push({
        page: `/${slug}.md`,
        reason: `正文首行應為 H1，實際為「${firstLine.slice(0, 40)}」`,
      });
    }
  }
});

// R4 的 HTML 宣告管道。Astro.url.pathname 是否帶結尾斜線會影響 BaseLayout 的推導結果，
// 推導失敗時宣告會靜默消失——頁面完全正常，只是少一條發現管道。
check('每個 HTML 頁面都宣告自己的 markdown 變體', (failures) => {
  for (const { pathname, html } of pages) {
    if (pathname === '/404' || pathname === '/404.html') continue;
    // pathname 來自 dist 目錄名，是解碼後的原始文字；href 屬性裡的網址則是
    // encodeURI 編碼過的（標籤頁的空白／中文最常見），兩者要編碼一致才能比對。
    const expected =
      pathname === '/' ? '/index.md' : `${encodeURI(pathname.replace(/\/$/, ''))}.md`;
    const re = new RegExp(
      `<link[^>]+type=["']text/markdown["'][^>]+href=["']${escapeRegExp(expected)}["']`,
    );
    if (!re.test(html)) {
      failures.push({ page: pathname, reason: `缺少指向 ${expected} 的 text/markdown 宣告` });
    }
  }
});

// ads.txt 宣告誰有權販售本站的廣告空間。它失效的方式是完全靜默的——檔案不見、改名、
// 或 publisher ID 被動過，站台一切正常，只有 AdSense 後台會冒出一行「找不到 ads.txt」，
// 而那個畫面沒有人天天看。這次就是這麼發生的：WordPress 遷移時（commit 212f279）把檔名
// 搬成 app-ads.txt（那是 AdMob 的規格），內容一字不差卻整整兩個多月沒被 Google 認到。
// 兩個檔都驗：app-ads.txt 是給已上架的行動 App 用的，不是可以拿掉的舊物。
check('ads.txt 與 app-ads.txt 都宣告正確的 publisher ID', (failures) => {
  for (const file of ['ads.txt', 'app-ads.txt']) {
    const filePath = path.join(DIST, file);
    if (!existsSync(filePath)) {
      failures.push({ page: `/${file}`, reason: '檔案不存在' });
      continue;
    }
    const text = readFileSync(filePath, 'utf8');
    if (!text.includes(ADS_TXT_PUBLISHER_ID)) {
      failures.push({ page: `/${file}`, reason: `未宣告 ${ADS_TXT_PUBLISHER_ID}` });
    }
  }
});

// 廣告只准出現在文章頁（spec R2）。這條斷言守的是兩個方向，漏哪一邊都很痛：
// 文章頁漏掉等於整件事白做；漏到列表頁或關於我頁則會直接打中 CI 稽核的另外三個
// 頁面，Lighthouse 門檻立刻紅，而原因會看起來像是與該 PR 無關的效能波動。
check('廣告版位只出現在文章頁', (failures) => {
  for (const { pathname, html } of pages) {
    const hasAd = html.includes(`data-ad-client="${ADSENSE_CLIENT_ATTR}"`);
    const isArticle = articlePathnames.has(pathname);
    if (isArticle && !hasAd) {
      failures.push({ page: pathname, reason: '文章頁缺少廣告版位' });
    } else if (!isArticle && hasAd) {
      failures.push({ page: pathname, reason: '非文章頁不應出現廣告版位' });
    }
  }
});

// _redirects 裡指向 /_astro/ 的目標必須真的被 emit 出來。
//
// 這條守的是 issue #35 留下的一個刻意取捨：cover.webp 與 logo.webp 搬進 src/assets/ 之後
// 網址帶內容雜湊，而 public/_redirects 為了不讓舊網址 404，把雜湊檔名寫死在 301 的目標裡。
// 換圖時那兩行必須跟著改——沒有這條檢查的話，忘了改的下場是 301 到一個不存在的檔案，
// build 全綠、頁面全正常，只有拿著舊網址來的社群爬蟲會撞到 404，而那正是當初加 301 要避免的。
check('_redirects 指向 /_astro/ 的目標都存在於建置產物', (failures) => {
  const redirectsPath = path.join(DIST, '_redirects');
  if (!existsSync(redirectsPath)) {
    failures.push({ page: '/_redirects', reason: '檔案不存在' });
    return;
  }
  for (const line of readFileSync(redirectsPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const target = trimmed.split(/\s+/)[1];
    if (!target?.startsWith('/_astro/')) continue;
    if (!existsSync(path.join(DIST, target.replace(/^\//, '')))) {
      failures.push({ page: '/_redirects', reason: `301 目標不存在：${target}（來源 ${trimmed.split(/\s+/)[0]}）` });
    }
  }
});

// 同一個取捨的第二個實例：標籤網址 slugify（2026-08-19）為了不讓 2026-07-22 起用過的
// 那批網址 404，把 37 條「舊標籤網址 → 新標籤網址」寫進 _redirects。
//
// 標籤是作者在 frontmatter 裡隨手加的，刪掉最後一篇帶某標籤的文章、或只是改個寫法，
// 那個標籤頁就沒了，而指向它的 301 會安靜地變成「301 到 404」——比直接 404 更糟，
// 因為搜尋引擎會把權重轉過去才發現目標不存在。
check('_redirects 指向 /tag/ 的目標都存在於建置產物', (failures) => {
  const redirectsPath = path.join(DIST, '_redirects');
  if (!existsSync(redirectsPath)) {
    failures.push({ page: '/_redirects', reason: '檔案不存在' });
    return;
  }
  for (const line of readFileSync(redirectsPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [source, target] = trimmed.split(/\s+/);
    if (!target?.startsWith('/tag/')) continue;
    // 標籤含中文時網址是 percent-encoded，而 dist 裡的目錄名是原文，比對前要解碼。
    const dir = decodeURIComponent(target).replace(/^\//, '').replace(/\/$/, '');
    if (!existsSync(path.join(DIST, dir, 'index.html'))) {
      failures.push({ page: '/_redirects', reason: `301 目標不存在：${target}（來源 ${source}）` });
    }
  }
});

// ---------------------------------------------------------------------------
// 輸出報告
// ---------------------------------------------------------------------------

let anyFailed = false;

for (const { name, failures } of results) {
  const passed = failures.length === 0;
  if (!passed) anyFailed = true;
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}${passed ? '' : `（${failures.length} 個問題）`}`);
  if (!passed && !quiet) {
    for (const { page, reason } of failures.slice(0, 10)) {
      console.log(`    - ${page}: ${reason}`);
    }
    if (failures.length > 10) {
      console.log(`    ...以及其他 ${failures.length - 10} 個問題`);
    }
  }
}

console.log('');
console.log(`共檢查 ${pages.length} 個 HTML 頁面，${results.length} 項規則，${anyFailed ? '存在未通過項目' : '全數通過'}。`);

process.exit(anyFailed ? 1 : 0);
