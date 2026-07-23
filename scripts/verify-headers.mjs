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
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  'upgrade-insecure-requests',
];

const CHECKS = [
  {
    path: '/',
    header: 'content-security-policy',
    name: 'CSP 完整生效（未被 zone 層規則覆寫）',
    verify: (value) => {
      if (!value) return '沒有 CSP 標頭';
      const missing = EXPECTED_CSP_DIRECTIVES.filter((d) => !value.includes(d));
      if (missing.length) {
        return `缺少指令：${missing.join(' / ')}｜實際收到：${value}`;
      }
      return null;
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
  {
    path: '/fonts/inter-latin-400-normal.woff2',
    header: 'cache-control',
    name: '字型長期 immutable 快取',
    verify: (v) =>
      v?.includes('immutable') && /max-age=\d{7,}/.test(v) ? null : `實際為 ${v ?? '（無）'}`,
  },
];

// HTML 的快取驗證器（ETag / Last-Modified）。缺了會讓重複造訪無法走 304，
// 每次都得重下整份 HTML。Pages 本身會給 ETag，zone 設定可能把它吃掉。
const VALIDATOR_CHECK = {
  path: '/about/',
  name: 'HTML 有 ETag 或 Last-Modified（可走 304）',
};

const cache = new Map();
async function head(path) {
  if (!cache.has(path)) {
    const res = await fetch(ORIGIN + path, { redirect: 'follow' });
    if (!res.ok) throw new Error(`${path} 回應 ${res.status}`);
    cache.set(path, res.headers);
  }
  return cache.get(path);
}

let failed = 0;
console.log(`檢查來源：${ORIGIN}\n`);

for (const check of CHECKS) {
  const headers = await head(check.path);
  const problem = check.verify(headers.get(check.header));
  if (problem) {
    failed++;
    console.log(`[FAIL] ${check.name}`);
    console.log(`       ${check.path} → ${problem}`);
  } else {
    console.log(`[PASS] ${check.name}`);
  }
}

{
  const headers = await head(VALIDATOR_CHECK.path);
  const has = headers.get('etag') || headers.get('last-modified');
  if (has) {
    console.log(`[PASS] ${VALIDATOR_CHECK.name}`);
  } else {
    failed++;
    console.log(`[FAIL] ${VALIDATOR_CHECK.name}`);
    console.log(`       ${VALIDATOR_CHECK.path} → 兩者皆無（cf-cache-status: ${headers.get('cf-cache-status') ?? '?'}）`);
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
