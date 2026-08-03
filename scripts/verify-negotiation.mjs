/**
 * 驗證 Accept 內容協商（見 docs/specs/agent-markdown.md R11、情境 S10-S12）。
 *
 * 為什麼需要這支：協商邏輯活在 Cloudflare Pages Functions 裡，`astro preview` 不執行它，
 * `_headers` 也不套用——建置全綠、產物全對，協商仍可能完全沒生效。而失效的方式是靜默的：
 * 中介層任何一個環節出錯都退回 HTML，站台看起來完全正常。
 *
 * 用法：
 *   node scripts/verify-negotiation.mjs                      # 檢查 https://frankchen.tw
 *   node scripts/verify-negotiation.mjs http://localhost:8788 # 檢查本機 wrangler
 *
 * 任一項不符即 exit 1。
 */

const ORIGIN = (process.argv[2] ?? 'https://frankchen.tw').replace(/\/$/, '');
const MD_ACCEPT = { Accept: 'text/markdown' };

async function get(path, headers = {}) {
  try {
    const res = await fetch(ORIGIN + path, { headers, redirect: 'follow' });
    return { res, body: await res.text() };
  } catch (err) {
    return { error: `請求失敗：${err.message}` };
  }
}

function contentType(res) {
  return (res.headers.get('content-type') ?? '').toLowerCase();
}

function varyIncludesAccept(res) {
  return (res.headers.get('vary') ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .includes('accept');
}

/** 協商成功的完整契約，套用在每一種頁面形狀上。 */
function checkNegotiated(label, path) {
  return async () => {
    const { res, body, error } = await get(path, MD_ACCEPT);
    if (error) return error;
    const problems = [];
    if (res.status !== 200) problems.push(`狀態碼 ${res.status}（應為 200，不得用重導向達成）`);
    if (!contentType(res).startsWith('text/markdown')) {
      problems.push(`Content-Type 為 ${contentType(res) || '（無）'}`);
    }
    if (!varyIncludesAccept(res)) problems.push(`Vary 為 ${res.headers.get('vary') ?? '（無）'}`);
    // 協商回應走正規網址，帶 noindex 等於對頁面本體下架（spec D14）。
    if (res.headers.get('x-robots-tag')) {
      problems.push(`不應有 X-Robots-Tag，實際為 ${res.headers.get('x-robots-tag')}`);
    }
    if (!body.startsWith('---')) problems.push('內容未以 YAML frontmatter 開頭');
    if (/^\s*<(!doctype|html)/i.test(body)) problems.push('內容是 HTML，協商未生效');
    return problems.length ? `${label}：${problems.join('｜')}` : null;
  };
}

const CHECKS = [
  { name: '首頁協商回 markdown', run: checkNegotiated('/', '/') },
  { name: '靜態頁協商回 markdown', run: checkNegotiated('/about/', '/about/') },
  {
    name: '深層頁面協商回 markdown（驗全站範圍）',
    run: checkNegotiated('/category/n8n/', '/category/n8n/'),
  },
  {
    name: '不帶 Accept 時仍回 HTML（HTML 是預設）',
    run: async () => {
      const { res, error } = await get('/');
      if (error) return error;
      if (!contentType(res).startsWith('text/html')) return `Content-Type 為 ${contentType(res)}`;
      if (!varyIncludesAccept(res)) return `HTML 回應缺 Vary: Accept（實際 ${res.headers.get('vary') ?? '（無）'}）`;
      return null;
    },
  },
  {
    name: 'Accept: */* 不觸發協商',
    run: async () => {
      const { res, error } = await get('/', { Accept: '*/*' });
      if (error) return error;
      return contentType(res).startsWith('text/html') ? null : `Content-Type 為 ${contentType(res)}`;
    },
  },
  {
    name: '瀏覽器的 Accept 不觸發協商',
    run: async () => {
      const { res, error } = await get('/', {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8',
      });
      if (error) return error;
      return contentType(res).startsWith('text/html') ? null : `Content-Type 為 ${contentType(res)}`;
    },
  },
  {
    // 反向斷言：直接請求 .md 是另一種契約，那條路徑仍須帶 noindex（spec R5、D5）。
    name: '直接請求 .md 仍帶 noindex',
    run: async () => {
      const { res, error } = await get('/about.md');
      if (error) return error;
      const tag = res.headers.get('x-robots-tag');
      return tag?.toLowerCase().includes('noindex') ? null : `實際為 ${tag ?? '（無）'}`;
    },
  },
  {
    name: '不存在的路徑不因協商而改變行為',
    run: async () => {
      const plain = await get('/this-page-does-not-exist/');
      const negotiated = await get('/this-page-does-not-exist/', MD_ACCEPT);
      if (plain.error) return plain.error;
      if (negotiated.error) return negotiated.error;
      if (plain.res.status !== negotiated.res.status) {
        return `帶 Accept 時狀態碼為 ${negotiated.res.status}，不帶時為 ${plain.res.status}`;
      }
      return null;
    },
  },
  {
    name: '靜態資產不因協商而改變型別',
    run: async () => {
      const { res, error } = await get('/favicon.png', MD_ACCEPT);
      if (error) return error;
      return contentType(res).startsWith('image/') ? null : `Content-Type 為 ${contentType(res)}`;
    },
  },
  {
    // 有則帶（SKILL.md 的措辭是 if available），所以只在協商成功時要求它是正整數。
    name: 'x-markdown-tokens 為正整數',
    run: async () => {
      const { res, error } = await get('/', MD_ACCEPT);
      if (error) return error;
      const value = res.headers.get('x-markdown-tokens');
      if (!value) return '缺少 x-markdown-tokens';
      return /^\d+$/.test(value) && Number(value) > 0 ? null : `實際為 ${value}`;
    },
  },
];

let failed = 0;
console.log(`檢查來源：${ORIGIN}\n`);

for (const check of CHECKS) {
  const problem = await check.run();
  if (problem) {
    failed++;
    console.log(`[FAIL] ${check.name}`);
    console.log(`       ${problem}`);
  } else {
    console.log(`[PASS] ${check.name}`);
  }
}

console.log();
if (failed) {
  console.log(`${failed} 項不符。`);
  console.log(
    '協商邏輯在 functions/_middleware.js。本機要重現需以 wrangler 執行（npm run preview:pages），' +
      'astro preview 不會執行 Pages Functions。',
  );
  process.exit(1);
}
console.log('全部符合預期。');
