/**
 * 驗證正式站實際回傳的 HTTP 標頭，與 public/_headers 的意圖一致。
 *
 * 為什麼需要這支：`_headers` 是 Cloudflare Pages 的設定，但 frankchen.tw 這個
 * zone 另外還有自己的 Transform Rules / Managed Transforms。zone 層的規則會
 * 覆寫 Pages 送出的標頭，而且**不會有任何錯誤訊息**——build 綠燈、Pages 部署
 * 成功、`_headers` 檔案也沒錯，只是使用者實際拿到的標頭被換掉了。
 *
 * 2026-07-23 就實際踩到：pages.dev 上 CSP 完整生效，frankchen.tw 上卻只剩
 * `upgrade-insecure-requests`，X-Frame-Options 也從 DENY 變成 SAMEORIGIN。
 * 等於整套 CSP 硬化在正式站上沒有作用，而任何純看 repo 的檢查都發現不了。
 *
 * 用法：
 *   node scripts/verify-headers.mjs                    # 檢查 https://frankchen.tw
 *   node scripts/verify-headers.mjs <origin>           # 檢查指定來源（例如 preview）
 *
 * 任一項不符即 exit 1。
 */

import { parseLinkHeader } from './lib/link-header.mjs';

const ORIGIN = (process.argv[2] ?? 'https://frankchen.tw').replace(/\/$/, '');

// 期望值直接對照 public/_headers。改那個檔時請同步改這裡——
// 刻意不從 _headers 自動解析：那樣兩邊會一起錯，就失去對照的意義了。
const EXPECTED_CSP_DIRECTIVES = [
  "default-src 'self'",
  // Cloudflare Web Analytics 的 beacon 與回報端點：邊緣注入的第三方資源，
  // 不在 repo 裡，只看原始碼會漏掉（2026-07-23 實測 CSP 違規才發現）。
  //
  // AdSense 那一長串來源與 script-src 的 'unsafe-inline'：為什麼要讓步、付出了什麼、
  // 未來怎麼收回，全寫在 public/_headers 的 CSP 註解區（docs/specs/monetization.md D5），
  // 這裡不重述。但這支腳本的職責要分清楚：它比對的是「線上實際值 == _headers 的意圖」，
  // 不是「CSP 夠不夠嚴」。所以 _headers 一放寬，這裡就必須跟著放寬——否則報出來的
  // 不是 zone 層竄改，而是本檔自己的漂移（2026-08-07 的每日檢查就這樣紅了一次，
  // 訊息還寫著「可能是 zone 層規則注入」，實際注入者是我們自己的 hotfix）。
  // GA4 帶進來的三個來源（www.googletagmanager.com / stats.g.doubleclick.net /
  // analytics.google.com）都只服務次要請求——主要測量走閘道的第一方路徑，'self' 已涵蓋。
  // 補的理由與刻意不補 ga-audiences 的取捨同樣寫在 public/_headers 的 CSP 註解區。
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://partner.googleadservices.com https://adservice.google.com https://www.googletagservices.com https://fundingchoicesmessages.google.com https://ep2.adtrafficquality.google https://www.googletagmanager.com",
  "connect-src 'self' https://cloudflareinsights.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://fundingchoicesmessages.google.com https://ep1.adtrafficquality.google https://stats.g.doubleclick.net https://analytics.google.com",
  // frame-src 是 AdSense 例外帶進來的新指令（廣告與同意橫幅都跑在 iframe 裡）。
  // 沒有 'self'：本站自己不嵌任何同源 iframe。
  "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://fundingchoicesmessages.google.com https://ep2.adtrafficquality.google",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://www.google.com https://ep1.adtrafficquality.google",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  'upgrade-insecure-requests',
];

// 期望的 Link 標頭內容，同樣直接對照 public/_headers（理由見上方註解）。
// 站台層級三條每個 HTML 頁面都該有；/index.md 是首頁專屬——它是首頁這一頁的替代表示，
// 出現在文章頁上是錯的，所以下方比對用的是「集合完全相等」而非「包含」。
const EXPECTED_LINKS_SITE_WIDE = [
  ['/AGENTS.md', 'describedby'],
  ['/llms.txt', 'index'],
  ['/rss.xml', 'alternate'],
];
const EXPECTED_LINKS_HOME = [...EXPECTED_LINKS_SITE_WIDE, ['/index.md', 'alternate']];

/**
 * 產生一個比對 Link 標頭的 verify 函式。
 *
 * 比對的是 `(target, rel)` 集合而非字串包含：順序無關，而且多出來的 link-value 一定會被
 * 報出來——zone 層若注入一條指向別處的 link，包含式比對抓不到（見 parseCsp 的同一段理由）。
 */
function verifyLinks(expected) {
  return (value) => {
    if (!value) return '沒有 Link 標頭';
    const actual = new Set(
      parseLinkHeader(value).map(({ target, rel }) => `${target} rel=${rel ?? '（缺 rel）'}`),
    );
    const wanted = new Set(expected.map(([target, rel]) => `${target} rel=${rel}`));

    const problems = [];
    const missing = [...wanted].filter((key) => !actual.has(key));
    const extra = [...actual].filter((key) => !wanted.has(key));
    if (missing.length) problems.push(`缺少：${missing.join('、')}`);
    if (extra.length) {
      problems.push(`多出未預期的 link-value：${extra.join('、')}（可能是 zone 層規則注入）`);
    }
    return problems.length ? `${problems.join('｜')}｜實際收到：${value}` : null;
  };
}

/**
 * 把 CSP 值解析成 `指令名 -> 來源集合`。
 *
 * 為什麼不能用 `value.includes('script-src ...')` 那種整串比對：
 *   (a) 來源順序改變（語意完全相同）會誤報失敗；
 *   (b) 更嚴重——zone 層若偷偷多塞一個來源，例如
 *       `script-src 'self' https://static.cloudflareinsights.com https://evil.example`，
 *       includes 仍然為真，完全偵測不到。而這支腳本存在的唯一理由就是偵測
 *       zone 層的靜默竄改，漏掉「多出來的來源」等於漏掉最該抓的那種攻擊。
 * 改成集合比對後，順序無關、多一個少一個都會報。
 *
 * 來源一律轉小寫：CSP 的關鍵字（'self' / 'none'）與主機名稱都是大小寫不敏感的，
 * 不正規化會把 'SELF' 誤判成多出來的來源。
 */
function parseCsp(value) {
  const directives = new Map();
  const duplicated = [];
  for (const part of value.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const name = tokens[0].toLowerCase();
    // CSP 規格：同一指令重複出現時，後面的會被忽略，只有第一次出現的生效。
    // 這裡照規格取第一個，同時把重複的記下來另外報——重複本身就代表有人（或
    // 某條 zone 規則）在串接 CSP，即使結果無害也該被看見。
    if (directives.has(name)) {
      duplicated.push(name);
      continue;
    }
    directives.set(name, new Set(tokens.slice(1).map((s) => s.toLowerCase())));
  }
  return { directives, duplicated };
}

const CHECKS = [
  {
    path: '/',
    header: 'content-security-policy',
    name: 'CSP 完整生效（未被 zone 層規則覆寫）',
    verify: (value) => {
      if (!value) return '沒有 CSP 標頭';
      const expected = parseCsp(EXPECTED_CSP_DIRECTIVES.join('; ')).directives;
      const { directives: actual, duplicated } = parseCsp(value);
      const problems = [];

      for (const [name, expectedSources] of expected) {
        const actualSources = actual.get(name);
        if (!actualSources) {
          problems.push(`缺少指令 ${name}`);
          continue;
        }
        const missing = [...expectedSources].filter((s) => !actualSources.has(s));
        const extra = [...actualSources].filter((s) => !expectedSources.has(s));
        if (missing.length) problems.push(`${name} 缺少來源：${missing.join(' ')}`);
        if (extra.length) {
          problems.push(`${name} 多出未預期來源：${extra.join(' ')}（可能是 zone 層規則注入）`);
        }
      }
      for (const name of actual.keys()) {
        if (!expected.has(name)) {
          problems.push(`多出未預期的指令 ${name}（可能是 zone 層規則注入）`);
        }
      }
      if (duplicated.length) {
        problems.push(`指令重複出現（規格上後者會被忽略）：${[...new Set(duplicated)].join(' ')}`);
      }

      return problems.length ? `${problems.join('｜')}｜實際收到：${value}` : null;
    },
  },
  {
    path: '/',
    header: 'x-frame-options',
    name: 'X-Frame-Options 為 DENY',
    verify: (v) => (v?.toUpperCase() === 'DENY' ? null : `實際為 ${v ?? '（無）'}`),
  },
  {
    path: '/',
    header: 'strict-transport-security',
    name: 'HSTS 含 preload',
    verify: (v) => (v?.includes('preload') ? null : `實際為 ${v ?? '（無）'}`),
  },
  {
    path: '/',
    header: 'x-content-type-options',
    name: 'X-Content-Type-Options 為 nosniff',
    verify: (v) => (v === 'nosniff' ? null : `實際為 ${v ?? '（無）'}`),
  },
  {
    path: '/',
    header: 'referrer-policy',
    name: 'Referrer-Policy 為 strict-origin-when-cross-origin',
    verify: (v) =>
      v === 'strict-origin-when-cross-origin' ? null : `實際為 ${v ?? '（無）'}`,
  },
  {
    path: '/',
    header: 'cross-origin-opener-policy',
    name: 'COOP 為 same-origin',
    verify: (v) => (v === 'same-origin' ? null : `實際為 ${v ?? '（無）'}`),
  },
  {
    path: '/',
    header: 'cache-control',
    name: 'HTML 有短期快取（非 no-store）',
    verify: (v) => (v && /max-age=\d+/.test(v) && !v.includes('no-store') ? null : `實際為 ${v ?? '（無）'}`),
  },
  // Cloudflare Pages 的 _headers 對同一個標頭是合併不是覆蓋，多條規則命中同一路徑
  // 時值會被逗號串起來，產生兩組 max-age。瀏覽器只認第一個，等於後面那條規則靜默
  // 失效——標頭「有值」所以任何存在性檢查都抓不到。實測踩過（/llms.txt 與 /rss.xml），
  // 因此逐一驗證每種路徑類型的 Cache-Control 都只有一組 max-age。
  ...[
    ['/', 'HTML'],
    ['/robots.txt', 'robots.txt'],
    ['/llms.txt', 'llms.txt'],
    ['/rss.xml', 'rss.xml'],
    ['/favicon.png', 'favicon'],
    ['/n8n-resources/', 'n8n-resources 索引頁'],
  ].map(([path, label]) => ({
    path,
    header: 'cache-control',
    name: `${label} 的 Cache-Control 只有一組 max-age`,
    verify: (v) => {
      if (!v) return '沒有 Cache-Control';
      const n = (v.match(/max-age=/g) ?? []).length;
      return n === 1 ? null : `有 ${n} 組 max-age：${v}`;
    },
  })),
  {
    path: '/',
    header: 'link',
    name: '首頁的 Link 標頭（四份機器可讀產物）',
    verify: verifyLinks(EXPECTED_LINKS_HOME),
  },
  {
    path: '/about/',
    header: 'link',
    name: '內頁的 Link 標頭（不含首頁專屬的 /index.md）',
    verify: verifyLinks(EXPECTED_LINKS_SITE_WIDE),
  },
];

/**
 * HTML 的快取驗證器（ETag / Last-Modified）——**已知例外，不計入失敗**。
 *
 * 根因（2026-07-23 逐項量測）：Bot Fight 模式的 JS Detections 會在邊緣把
 * `__CF$cv$params` 那段注入 HTML，回應內容因此與來源不同，Cloudflare 就把
 * Pages 送出的 ETag 丟掉。證據——同一份部署、三種路徑：
 *   frankchen.tw   /about/  31998 B  含 JSD 注入  無 ETag
 *   *.pages.dev    /about/  31079 B  無注入      有 ETag
 *   frankchen.tw   .woff2   （不被改寫）          有 ETag
 *
 * 為什麼接受而不修：要讓 ETag 回來得關掉 Bot Fight 模式（失去全站機器人防護），
 * 或加 Cache Rule 快取 HTML（部署後可能短暫服務舊內容）。換到的效益很小——
 * HTML 已有 max-age=600，10 分鐘內不會重新驗證；真的驗證時 304 相對於
 * brotli 壓縮後的 200 只省約 9.5 KB。crawl budget 也不是 104 頁網站的瓶頸。
 *
 * 保留這項檢查而不刪除：日檢仍會印出目前狀態，狀況若改變（ETag 回來了、或
 * 換了別的原因）看得出來，不會讓後人以為是沒人檢查過的漏網之魚。
 */
const VALIDATOR_CHECK = {
  path: '/about/',
  name: 'HTML 有 ETag 或 Last-Modified（可走 304）',
};

/**
 * 取回某路徑的回應標頭。
 *
 * 回傳 `{ headers }` 或 `{ error }`——刻意不 throw：以前非 200 直接 throw 會讓
 * 整支腳本在第一個壞掉的路徑就中斷，後面所有檢查連跑都沒跑，結果只看得到一行
 * 例外訊息，不知道其他項目是好是壞。現在該路徑記成一項 FAIL，其餘照跑。
 *
 * 失敗結果也要進快取：同一路徑會被多項檢查共用（'/' 就有七項），不快取失敗的話
 * 站台掛掉時每項都會各自重打一次請求，慢且沒有意義。
 */
const cache = new Map();
async function head(path) {
  if (!cache.has(path)) {
    let entry;
    try {
      const res = await fetch(ORIGIN + path, { redirect: 'follow' });
      entry = res.ok
        ? { headers: res.headers }
        : { error: `請求回應 ${res.status}${res.statusText ? ` ${res.statusText}` : ''}` };
    } catch (err) {
      entry = { error: `請求失敗：${err.message}` };
    }
    cache.set(path, entry);
  }
  return cache.get(path);
}

/**
 * 從線上站首頁 HTML 取一個字型檔路徑當受測對象。
 *
 * 為什麼不寫死 `/fonts/inter-latin-400-normal.woff2`：PR #29 起字型子集檔名改成
 * 「原名 + sha256 前 8 碼」（例如 inter-latin-400-normal.1a37bf8f.woff2），
 * 每次 build 內容有變檔名就變，寫死必定 404。
 * 為什麼也不讀 src/styles/font-preloads.json 或 dist/：這支腳本是對線上站發請求的，
 * 日檢 workflow 並不會先 build，本地也未必有建置產物；而且線上站當下用的檔名
 * 未必等於本地剛 build 出來的。從首頁 HTML 抓，受測對象永遠是線上站真正在用的那支。
 */
async function resolveFontPath() {
  let html;
  try {
    const res = await fetch(`${ORIGIN}/`, { redirect: 'follow' });
    if (!res.ok) return { error: `首頁請求回應 ${res.status}` };
    html = await res.text();
  } catch (err) {
    return { error: `首頁請求失敗：${err.message}` };
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/\brel\s*=\s*["']?preload\b/i.test(tag)) continue;
    if (!/\bas\s*=\s*["']?font\b/i.test(tag)) continue;
    const href = tag.match(/\bhref\s*=\s*"([^"]*)"|\bhref\s*=\s*'([^']*)'/i);
    const value = href?.[1] ?? href?.[2];
    if (!value) continue;
    try {
      // 相對路徑與絕對 URL 都接受，統一取回 pathname 供 head() 接原點使用
      return { path: new URL(value, `${ORIGIN}/`).pathname };
    } catch {
      continue;
    }
  }
  // 抓不到本身就是問題：字型 preload 消失代表 LCP 會退化，或建置流程壞了。
  return { error: '首頁沒有任何 <link rel="preload" as="font">' };
}

/**
 * 從線上 llms.txt 取一個 md 變體路徑當受測對象。
 *
 * 為什麼不寫死某篇文章的 slug：文章可能改名或下架，寫死的路徑總有一天會 404，
 * 屆時看起來像標頭壞了，其實是檢查本身過期。從 llms.txt 取則永遠指向線上站
 * 當下真的有宣告的那批 md——順帶也驗證了「宣告管道確實存在」。
 *
 * 取「第一個」.md 網址是有前提的：llms.txt 的前段刻意不寫出完整的 .md 範例網址
 * （見 src/pages/llms.txt.ts 該段註解），所以第一個必然落在文章清單裡。日後若在前段
 * 補一個 /index.md 之類的連結，本腳本與 scripts/verify-negotiation.mjs 會同時去打
 * /index/ 並報假紅燈。改 llms.txt 前段時要一併看這兩支。
 */
async function resolveMarkdownPath() {
  let text;
  try {
    const res = await fetch(`${ORIGIN}/llms.txt`, { redirect: 'follow' });
    if (!res.ok) return { error: `llms.txt 請求回應 ${res.status}` };
    text = await res.text();
  } catch (err) {
    return { error: `llms.txt 請求失敗：${err.message}` };
  }
  const match = text.match(/https:\/\/[^\s)）]+\.md/);
  if (!match) return { error: 'llms.txt 未宣告任何 .md 變體網址' };
  try {
    return { path: new URL(match[0]).pathname };
  } catch {
    return { error: `llms.txt 宣告的 .md 網址無法解析：${match[0]}` };
  }
}

// 從線上 sitemap 取一個路徑深度 ≥ 2 的頁面（例如 /category/n8n/）當受測對象。
//
// 為什麼非要深層頁面不可：`_headers` 的 `/*/` 規則能涵蓋全站，前提是 Cloudflare 的 splat
// 真的跨斜線比對。這個假設只在深層路徑上會露餡——若 splat 其實不跨斜線，/about/ 照樣有
// 標頭，/category/n8n/ 卻沒有，只驗一層的頁面完全看不出來。
//
// 為什麼不寫死 /category/n8n/：category enum 是會變的（改名或下架就 404），屆時看起來像
// 標頭壞了，其實是檢查本身過期。從 sitemap 取則永遠指向線上站當下真的有的頁面。
async function resolveNestedPagePath() {
  let xml;
  try {
    const res = await fetch(`${ORIGIN}/sitemap.xml`, { redirect: 'follow' });
    if (!res.ok) return { error: `sitemap.xml 請求回應 ${res.status}` };
    xml = await res.text();
  } catch (err) {
    return { error: `sitemap.xml 請求失敗：${err.message}` };
  }
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    let pathname;
    try {
      pathname = new URL(match[1].trim()).pathname;
    } catch {
      continue;
    }
    if (pathname.endsWith('/') && pathname.split('/').filter(Boolean).length >= 2) {
      return { path: pathname };
    }
  }
  return { error: 'sitemap.xml 沒有任何深度 ≥ 2 的頁面網址' };
}

/**
 * 從首頁 header 的頭像 <img> 取 logo 的實際網址。
 *
 * 這條同時驗兩件事，而且順序有意義：先驗 logo 真的落在 /_astro/（issue #35 把它從
 * public/ 搬進 src/assets/ 走 astro:assets，退回固定檔名就是這次修正被還原了），
 * 再驗那個路徑吃得到一年 immutable。少了前半，後半會在 logo 退回 /logo.webp 時
 * 靜默改去驗別的東西；少了後半，搬家等於白做。
 *
 * 為什麼不寫死雜湊檔名：內容一變檔名就變，寫死必定 404（理由同 resolveFontPath）。
 */
async function resolveLogoPath() {
  let html;
  try {
    const res = await fetch(`${ORIGIN}/`, { redirect: 'follow' });
    if (!res.ok) return { error: `首頁請求回應 ${res.status}` };
    html = await res.text();
  } catch (err) {
    return { error: `首頁請求失敗：${err.message}` };
  }
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (!/\bclass\s*=\s*["'][^"']*\bheader-avatar\b/i.test(tag)) continue;
    const href = tag.match(/\bsrc\s*=\s*"([^"]*)"|\bsrc\s*=\s*'([^']*)'/i);
    const value = href?.[1] ?? href?.[2];
    if (!value) continue;
    let pathname;
    try {
      pathname = new URL(value, `${ORIGIN}/`).pathname;
    } catch {
      continue;
    }
    if (!pathname.startsWith('/_astro/')) {
      return {
        error: `logo 應為 /_astro/ 下的雜湊檔名（issue #35），實際為 ${pathname}`,
      };
    }
    return { path: pathname };
  }
  return { error: '首頁 header 沒有 class="header-avatar" 的 <img>' };
}

/**
 * 從一篇文章的 og:image 取 OG 圖網址。
 *
 * 為什麼從文章頁抓而不寫死某個 slug：文章會改名或下架，寫死總有一天 404，屆時看起來
 * 像標頭壞了，其實是檢查本身過期（理由同 resolveMarkdownPath）。
 *
 * OG 圖自 2026-08-14 起為 /og/<slug>.<hash>.png（issue #55），雜湊取自 PNG 輸出位元組。
 * 因此下面的斷言不只驗 TTL，也驗網址形狀——形狀退化回固定檔名時，一年 immutable 會
 * 讓 2026-07-23 那次的災情（改標題後社群卡片整年不更新）變得更嚴重而非更輕。
 */
async function resolveOgImagePath(articlePath) {
  let html;
  try {
    const res = await fetch(`${ORIGIN}${articlePath}`, { redirect: 'follow' });
    if (!res.ok) return { error: `文章頁請求回應 ${res.status}` };
    html = await res.text();
  } catch (err) {
    return { error: `文章頁請求失敗：${err.message}` };
  }
  const meta = html.match(
    /<meta\b[^>]*\bproperty\s*=\s*["']og:image["'][^>]*\bcontent\s*=\s*["']([^"']+)["']/i,
  );
  if (!meta) return { error: `${articlePath} 沒有 og:image` };
  try {
    return { path: new URL(meta[1], `${ORIGIN}/`).pathname };
  } catch {
    return { error: `og:image 網址無法解析：${meta[1]}` };
  }
}

let failed = 0;
console.log(`檢查來源：${ORIGIN}\n`);

const checks = [...CHECKS];
const fontPath = await resolveFontPath();
if (fontPath.path) {
  checks.push(
    {
      path: fontPath.path,
      header: 'cache-control',
      name: `字型長期 immutable 快取（${fontPath.path}）`,
      verify: (v) =>
        v?.includes('immutable') && /max-age=\d{7,}/.test(v) ? null : `實際為 ${v ?? '（無）'}`,
    },
    // 反向斷言：Link 標頭只該掛在 HTML 頁面上。`_headers` 的 `/*/` 若因為 Cloudflare 的
    // 比對語意與文件不同而吻合過頭，站台功能完全正常、外部檢測照樣通過，只是每位讀者的
    // 每一個子資源都默默多背 200 bytes——沒有這條斷言，這種退化不會有任何跡象。
    {
      path: fontPath.path,
      header: 'link',
      name: `靜態資產不帶 Link 標頭（${fontPath.path}）`,
      verify: (v) => (v ? `不應有 Link 標頭，實際為 ${v}` : null),
    },
  );
} else {
  checks.push({ path: '/', name: '首頁可取得字型 preload 路徑', staticProblem: fontPath.error });
}

// 靜態圖示的 Cache-Control 實值。原本這裡只驗「只有一組 max-age」，值是多少沒人管——
// 而 2026-07-23 出事的正是「值」：zone 的 Cache Rule 把瀏覽器 TTL 一律覆寫成一年，
// _headers 寫的 86400／604800 全被蓋掉，格式完全合法、只有一組 max-age，任何既有檢查
// 都照樣綠燈。站主當時是靠人工比對 pages.dev 與正式站才診斷出來的（issue #35）。
// 那個修正是 dashboard 設定、不在版控，隨時可能被改回去或在重建 zone 時重演，
// 所以這幾條逐一釘住實值——退化就在隔天的日檢紅燈，不必再靠人工發現。
//
// favicon 與 apple-touch-icon 刻意維持固定檔名不加雜湊（理由見 public/_headers），
// 也就是說它們的快取正確性永遠只能靠 TTL 撐著，比其他資源更需要這條斷言。
checks.push(
  ...[
    ['/favicon.png', 'favicon', 86400],
    ['/apple-touch-icon.png', 'apple-touch-icon', 86400],
  ].map(([path, label, seconds]) => ({
    path,
    header: 'cache-control',
    name: `${label} 的瀏覽器 TTL 為 ${seconds} 秒`,
    verify: (v) => (v === `public, max-age=${seconds}` ? null : `實際為 ${v ?? '（無）'}`),
  })),
);

const logoPath = await resolveLogoPath();
if (logoPath.path) {
  checks.push({
    path: logoPath.path,
    header: 'cache-control',
    name: `雜湊檔名的站台圖片吃到一年 immutable（${logoPath.path}）`,
    verify: (v) =>
      v?.includes('immutable') && /max-age=\d{7,}/.test(v) ? null : `實際為 ${v ?? '（無）'}`,
  });
} else {
  checks.push({ path: '/', name: '首頁可取得 logo 路徑', staticProblem: logoPath.error });
}

const nestedPath = await resolveNestedPagePath();
if (nestedPath.path) {
  checks.push({
    path: nestedPath.path,
    header: 'link',
    name: `深層頁面的 Link 標頭（${nestedPath.path}，驗 splat 跨斜線）`,
    verify: verifyLinks(EXPECTED_LINKS_SITE_WIDE),
  });
} else {
  checks.push({
    path: '/sitemap.xml',
    name: '可從 sitemap 取得深層頁面路徑',
    staticProblem: nestedPath.error,
  });
}

const markdownPath = await resolveMarkdownPath();
if (markdownPath.path) {
  checks.push(
    {
      path: markdownPath.path,
      header: 'content-type',
      name: `Markdown 變體的 Content-Type（${markdownPath.path}）`,
      verify: (v) =>
        v?.toLowerCase().startsWith('text/markdown') ? null : `實際為 ${v ?? '（無）'}`,
    },
    {
      path: markdownPath.path,
      header: 'cache-control',
      name: 'Markdown 變體的快取與 HTML 一致',
      verify: (v) =>
        v === 'public, max-age=600, must-revalidate' ? null : `實際為 ${v ?? '（無）'}`,
    },
    {
      path: markdownPath.path,
      header: 'x-robots-tag',
      name: 'Markdown 變體帶 noindex（防重複內容收錄）',
      verify: (v) => (v?.toLowerCase().includes('noindex') ? null : `實際為 ${v ?? '（無）'}`),
    },
    // 文章頁本身的 Link 標頭。/about/ 與深層頁驗的是「一層」與「多層」兩種路徑形狀，
    // 但兩者都不是文章——spec S8 要的是文章頁，而 md 變體的路徑去掉 .md 加斜線就是它的
    // HTML 正本（llms.txt 只宣告文章的 md，不含 /index.md，所以不會推出 /index/）。
    {
      path: markdownPath.path.replace(/\.md$/, '/'),
      header: 'link',
      name: `文章頁的 Link 標頭（${markdownPath.path.replace(/\.md$/, '/')}）`,
      verify: verifyLinks(EXPECTED_LINKS_SITE_WIDE),
    },
  );

  // OG 圖的一年 immutable，外加「網址真的帶雜湊」這道反向斷言。從同一篇文章的 og:image
  // 取路徑——不寫死 slug 的理由見 resolveOgImagePath，而要釘住實值的理由見上面那組
  // 靜態圖示的註解。
  //
  // 兩條缺一不可：只驗 TTL 的話，程式碼哪天退化回固定檔名，一年 immutable 反而變成
  // 比原本一週更嚴重的災難（改標題後社群卡片在回訪者瀏覽器裡凍一整年），而斷言照樣綠燈。
  const ogImagePath = await resolveOgImagePath(markdownPath.path.replace(/\.md$/, '/'));
  if (ogImagePath.path) {
    checks.push(
      {
        path: ogImagePath.path,
        header: 'content-type',
        name: `OG 圖網址帶內容雜湊且可取得（${ogImagePath.path}）`,
        verify: (v) =>
          !/^\/og\/.+\.[0-9a-f]{8}\.png$/.test(ogImagePath.path)
            ? '網址未帶 8 碼內容雜湊，快取正確性又退回只能靠 TTL 撐著'
            : v?.startsWith('image/png')
              ? null
              : `Content-Type 實際為 ${v ?? '（無）'}`,
      },
      {
        path: ogImagePath.path,
        header: 'cache-control',
        name: `OG 圖吃到一年 immutable（${ogImagePath.path}）`,
        verify: (v) =>
          v?.includes('immutable') && /max-age=\d{7,}/.test(v) ? null : `實際為 ${v ?? '（無）'}`,
      },
    );
  } else {
    checks.push({
      path: markdownPath.path.replace(/\.md$/, '/'),
      name: '可從文章頁取得 OG 圖路徑',
      staticProblem: ogImagePath.error,
    });
  }
} else {
  checks.push({
    path: '/llms.txt',
    name: '可從 llms.txt 取得 Markdown 變體路徑',
    staticProblem: markdownPath.error,
  });
}

for (const check of checks) {
  let problem = check.staticProblem;
  if (!problem) {
    const { headers, error } = await head(check.path);
    problem = error ?? check.verify(headers.get(check.header));
  }
  if (problem) {
    failed++;
    console.log(`[FAIL] ${check.name}`);
    console.log(`       ${check.path} → ${problem}`);
  } else {
    console.log(`[PASS] ${check.name}`);
  }
}

{
  const { headers, error } = await head(VALIDATOR_CHECK.path);
  // 抓不到回應是真的失敗，不適用下面那個「已知例外」——那項豁免只針對
  // 「請求成功但沒有 ETag／Last-Modified」這個特定狀況。
  if (error) {
    failed++;
    console.log(`[FAIL] ${VALIDATOR_CHECK.name}`);
    console.log(`       ${VALIDATOR_CHECK.path} → ${error}`);
  } else if (headers.get('etag') || headers.get('last-modified')) {
    console.log(`[PASS] ${VALIDATOR_CHECK.name}`);
  } else {
    // 刻意不 failed++：見上方註解，這是已評估接受的取捨，不是待修的缺陷。
    console.log(`[已知例外] ${VALIDATOR_CHECK.name}`);
    console.log(
      `           ${VALIDATOR_CHECK.path} → 兩者皆無（cf-cache-status: ${headers.get('cf-cache-status') ?? '?'}）。` +
        'Bot Fight 模式的 JS Detections 改寫 HTML 導致 ETag 被丟棄，已評估接受。',
    );
  }
}

console.log();
if (failed) {
  console.log(`${failed} 項不符。`);
  console.log(
    'Pages 的 _headers 若在 *.pages.dev 上是對的、在正式網域上卻不對，' +
      '問題在 zone 層：Cloudflare Dashboard → Rules → Transform Rules → ' +
      'Modify Response Header，以及 Rules → Managed Transforms。',
  );
  process.exit(1);
}
console.log('全部符合預期。');
