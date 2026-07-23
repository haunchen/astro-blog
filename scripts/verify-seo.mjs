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

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = path.join(PROJECT_ROOT, 'dist');
const SITE_HOST = 'frankchen.tw';
const SITE_ORIGIN = `https://${SITE_HOST}`;

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
// 判定「文章頁」：與 astro.config.mjs 的 POST_LASTMOD 用同一套 id 推導規則，
// 確保這裡認定的文章集合跟 sitemap lastmod 邏輯一致，不會各自走鐘。
// ---------------------------------------------------------------------------

const articlePathnames = new Set(
  globSync('src/content/posts/**/*.md', { cwd: PROJECT_ROOT }).map((file) => {
    const id = file
      .replace(/\\/g, '/')
      .replace(/^src\/content\/posts\//, '')
      .replace(/\/index\.md$/, '')
      .replace(/\.md$/, '');
    return `/${id}/`;
  }),
);

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
    const parsed = [];
    let hasError = false;
    for (const block of blocks) {
      try {
        parsed.push(JSON.parse(block));
      } catch (err) {
        hasError = true;
        failures.push({ page: page.pathname, reason: `JSON-LD 解析失敗：${err.message}` });
      }
    }
    if (!hasError) pageJsonLd.set(page.pathname, parsed);
    else pageJsonLd.set(page.pathname, parsed);
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
