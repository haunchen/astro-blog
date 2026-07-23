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

const ORIGIN = (process.argv[2] ?? 'https://frankchen.tw').replace(/\/$/, '');

// 期望值直接對照 public/_headers。改那個檔時請同步改這裡——
// 刻意不從 _headers 自動解析：那樣兩邊會一起錯，就失去對照的意義了。
const EXPECTED_CSP_DIRECTIVES = [
  "default-src 'self'",
  // Cloudflare Web Analytics 的 beacon 與回報端點：邊緣注入的第三方資源，
  // 不在 repo 裡，只看原始碼會漏掉（2026-07-23 實測 CSP 違規才發現）。
  "script-src 'self' https://static.cloudflareinsights.com",
  "connect-src 'self' https://cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  'upgrade-insecure-requests',
];

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

let failed = 0;
console.log(`檢查來源：${ORIGIN}\n`);

const checks = [...CHECKS];
const fontPath = await resolveFontPath();
if (fontPath.path) {
  checks.push({
    path: fontPath.path,
    header: 'cache-control',
    name: `字型長期 immutable 快取（${fontPath.path}）`,
    verify: (v) =>
      v?.includes('immutable') && /max-age=\d{7,}/.test(v) ? null : `實際為 ${v ?? '（無）'}`,
  });
} else {
  checks.push({ path: '/', name: '首頁可取得字型 preload 路徑', staticProblem: fontPath.error });
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
