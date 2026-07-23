#!/usr/bin/env node
/**
 * 建置後靜態 SEO 驗證。
 *
 * 為什麼不用線上工具（Screaming Frog / Search Console 等）：那些要嘛要人工跑、
 * 要嘛要等 Google 重新爬取才看得到結果，沒辦法卡在 PR 階段擋下退化。這支腳本
 * 直接讀 dist/ 的靜態輸出做斷言，能在幾秒內於 CI 跑完、對每個頁面逐一檢查。
 *
 * 只用純 Node + 專案既有依賴（glob / gray-matter / fast-xml-parser），刻意不用
 * DOM 解析套件（jsdom 等）——SEO 要看的都是固定格式的 meta/link/script 標籤，
 * regex 抓取夠用且不必多背一個重量級依賴。
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';
import matter from 'gray-matter';
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

function findMetaByAttr(html, attrName, attrValue) {
  return findTags(html, 'meta').filter(
    (tag) => (getAttr(tag, attrName) ?? '').toLowerCase() === attrValue.toLowerCase(),
  );
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
  html: readFileSync(path.join(DIST, relFile), 'utf8'),
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

check('每頁有非空 <meta name="description">', (failures) => {
  for (const { pathname, html } of pages) {
    const tags = findMetaByAttr(html, 'name', 'description');
    if (tags.length === 0) {
      failures.push({ page: pathname, reason: '缺少 meta description' });
    } else if (!(getAttr(tags[0], 'content') ?? '').trim()) {
      failures.push({ page: pathname, reason: 'meta description 為空' });
    }
  }
});

check('每頁有 <link rel="canonical">，host 為 frankchen.tw', (failures) => {
  for (const { pathname, html } of pages) {
    const tags = findTags(html, 'link').filter(
      (tag) => (getAttr(tag, 'rel') ?? '').toLowerCase() === 'canonical',
    );
    if (tags.length === 0) {
      failures.push({ page: pathname, reason: '缺少 canonical' });
      continue;
    }
    const href = getAttr(tags[0], 'href');
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

check('每頁有 <meta name="robots">', (failures) => {
  for (const { pathname, html } of pages) {
    const tags = findMetaByAttr(html, 'name', 'robots');
    if (tags.length === 0) {
      failures.push({ page: pathname, reason: '缺少 meta robots' });
    } else if (!(getAttr(tags[0], 'content') ?? '').trim()) {
      failures.push({ page: pathname, reason: 'meta robots 為空' });
    }
  }
});

check('每頁有 og:title / og:description / og:image / og:url', (failures) => {
  const props = ['og:title', 'og:description', 'og:image', 'og:url'];
  for (const { pathname, html } of pages) {
    const missing = props.filter((prop) => {
      const tags = findMetaByAttr(html, 'property', prop);
      return tags.length === 0 || !(getAttr(tags[0], 'content') ?? '').trim();
    });
    if (missing.length > 0) {
      failures.push({ page: pathname, reason: `缺少或為空：${missing.join(', ')}` });
    }
  }
});

check('每頁有 twitter:card', (failures) => {
  for (const { pathname, html } of pages) {
    const tags = findMetaByAttr(html, 'name', 'twitter:card');
    if (tags.length === 0) {
      failures.push({ page: pathname, reason: '缺少 twitter:card' });
    } else if (!(getAttr(tags[0], 'content') ?? '').trim()) {
      failures.push({ page: pathname, reason: 'twitter:card 為空' });
    }
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
