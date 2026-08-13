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

/**
 * 從線上 llms.txt 取一篇真實文章的 md 變體路徑，推回它的 HTML 網址。
 *
 * 為什麼一定要文章頁：S10／S11 明文要求「任一文章頁」，而文章走的是 R1 手寫的
 * markdown 管線（spec D12），與首頁／about／category 這類 R10 建置後轉換管線完全不同的
 * 程式碼路徑。只驗 R10 頁面，文章那條管線協商壞了也測不出來。
 * 為什麼不寫死某個 slug：文章可能改名或下架，寫死遲早 404，屆時看起來像協商壞了，
 * 其實是檢查本身過期。從 llms.txt 取則永遠指向線上站當下真的有宣告的那批文章
 * （做法比照 scripts/verify-headers.mjs 的 resolveMarkdownPath()）。
 *
 * 取「第一個」.md 網址是有前提的：llms.txt 的前段刻意不寫出完整的 .md 範例網址
 * （見 src/pages/llms.txt.ts 該段註解），所以第一個必然落在文章清單裡。日後若在前段
 * 補一個 /index.md 之類的連結，這裡會推出 /index/，本腳本與 verify-headers.mjs 會
 * 同時報「協商壞了」，而站台其實好好的。改 llms.txt 前段時要一併看這兩支。
 */
async function resolveArticlePath() {
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
  let mdPath;
  try {
    mdPath = new URL(match[0]).pathname;
  } catch {
    return { error: `llms.txt 宣告的 .md 網址無法解析：${match[0]}` };
  }
  return { mdPath, htmlPath: mdPath.replace(/\.md$/, '/') };
}

/**
 * 從線上 sitemap 取一個路徑深度 ≥ 2 的頁面（例如 /category/n8n/）當受測對象。
 *
 * 為什麼要深層頁面：協商由 functions/_middleware.js 全站處理，而 public/_routes.json 的
 * 排除規則是前綴比對——排錯一條就會讓某整批深層路徑跳過 Worker，只驗 / 與 /about/ 完全
 * 看不出來。
 *
 * 為什麼不寫死 /category/n8n/：category enum 是會變的（改名或下架就 404），屆時看起來像
 * 協商壞了，其實是檢查本身過期。做法與理由都比照 verify-headers.mjs 的 resolveNestedPagePath()。
 */
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

/** 協商成功的完整契約，套用在每一種頁面形狀上。 */
function checkNegotiated(label, path) {
  return async () => {
    const { res, body, error } = await get(path, MD_ACCEPT);
    if (error) return error;
    const problems = [];
    if (res.status !== 200) problems.push(`狀態碼 ${res.status}（應為 200，不得用重導向達成）`);
    // get() 用 redirect: 'follow'，所以 3xx 會被 fetch 透明吃掉、status 看到的永遠是終點的 200——
    // 光比對 status 抓不到「其實繞了一手重導向」。res.redirected 是 fetch 自己記錄的旗標，
    // 才是唯一能揭穿「用重導向達成」的信號。
    if (res.redirected) problems.push('回應經由重導向達成（應在原網址完成）');
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
      const problems = [];
      if (plain.res.status !== negotiated.res.status) {
        problems.push(`帶 Accept 時狀態碼為 ${negotiated.res.status}，不帶時為 ${plain.res.status}`);
      }
      // S12 要求「404 頁仍為 404 HTML」——只比對狀態碼會漏掉「狀態碼仍是 404，
      // 但 Content-Type 被協商換成了 text/markdown」這種半生不熟的退化。
      if (contentType(plain.res) !== contentType(negotiated.res)) {
        problems.push(
          `Content-Type 不一致：帶 Accept 時為 ${contentType(negotiated.res) || '（無）'}，` +
            `不帶時為 ${contentType(plain.res) || '（無）'}`,
        );
      }
      return problems.length ? problems.join('｜') : null;
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
    // spec MODIFIED R5 的措辭是「有能力計算時帶」，這裡刻意比 spec 嚴，要求一定要有：
    // 本站的 functions/_middleware.js 對每個協商回應都無條件算 estimateTokens()，
    // 「沒帶」在本站只可能是那段程式碼壞了或標頭被中間層吃掉，兩種都該紅燈。
    // 這條嚴格性綁的是本站實作而非 spec——哪天中介層改成有條件計算，要先鬆這條。
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

const checks = [...CHECKS];

const nestedPage = await resolveNestedPagePath();
if (nestedPage.path) {
  checks.push({
    name: `深層頁面協商回 markdown（${nestedPage.path}）`,
    run: checkNegotiated(nestedPage.path, nestedPage.path),
  });
} else {
  // 靜默跳過等於這條斷言不存在——解析失敗要明確算一項 FAIL，而不是少印一行。
  checks.push({ name: '可從 sitemap 取得深層頁面路徑（供全站範圍檢查使用）', run: async () => nestedPage.error });
}

const article = await resolveArticlePath();
if (article.htmlPath) {
  checks.push(
    { name: `文章頁協商回 markdown（${article.htmlPath}）`, run: checkNegotiated(article.htmlPath, article.htmlPath) },
    {
      // 反向斷言的文章頁版本：/about.md 驗的是 R10 管線，這裡驗的是 R1 手寫管線，
      // 兩條管線各自獨立，缺一個都會漏掉那條管線的 noindex 退化。
      name: `文章頁直接請求 .md 仍帶 noindex（${article.mdPath}）`,
      run: async () => {
        const { res, error } = await get(article.mdPath);
        if (error) return error;
        const tag = res.headers.get('x-robots-tag');
        return tag?.toLowerCase().includes('noindex') ? null : `實際為 ${tag ?? '（無）'}`;
      },
    },
  );
} else {
  // 靜默跳過等於這兩條斷言不存在——解析失敗時明確報一項 FAIL，而不是少印兩行。
  checks.push({ name: '可從 llms.txt 取得文章頁路徑（供文章協商檢查使用）', run: async () => article.error });
}

let failed = 0;
console.log(`檢查來源：${ORIGIN}\n`);

for (const check of checks) {
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
