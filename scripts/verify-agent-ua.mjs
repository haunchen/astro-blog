/**
 * 驗證即時取用型 agent 的 UA 偵測（見 docs/specs/agent-markdown.md R12、情境 S13-S15）。
 *
 * 為什麼需要這支：偵測邏輯活在 Cloudflare Pages Functions 裡，`astro preview` 不執行它，
 * `verify:seo` 只看 dist 的靜態產物。而它壞掉的方式是靜默的——標頭沒出現，站台看起來
 * 完全正常。
 *
 * 反向斷言與正向斷言同等重要：判準寫太寬的退化同樣靜默（站台功能完全正常，只是每位
 * 讀者的每個頁面回應都多背一個標頭，還會把索引型爬蟲一起認成即時取用型）。
 *
 * 用法：
 *   node scripts/verify-agent-ua.mjs                      # 檢查 https://frankchen.tw
 *   node scripts/verify-agent-ua.mjs http://localhost:8788 # 檢查本機 wrangler
 *
 * 任一項不符即 exit 1。
 */

const ORIGIN = (process.argv[2] ?? 'https://frankchen.tw').replace(/\/$/, '');

/**
 * 白名單：即時取用型 agent（spec D18）。第二欄是命中時 `x-agent-detected` 應回的名稱。
 *
 * UA 字串取各家公開文件的長相，重點在中段的 `<名稱>/<版本>` 那一節——判準綁的是那個，
 * 前後綴不影響命中。
 */
const ALLOWED = [
  [
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +claude-user@anthropic.com)',
    'Claude-User',
  ],
  [
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)',
    'ChatGPT-User',
  ],
  [
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
    'Perplexity-User',
  ],
];

/**
 * 明確不該命中的 UA。
 *
 * 索引型（SearchBot 類）是這一組的重點：第二階段會把命中者導向帶 `X-Robots-Tag: noindex`
 * 的 `/<slug>.md`，把它們認進來等於自斷收錄（spec D18）。最後一條是判準本身的邊界——
 * `Claude-UserAgent` 只是前綴相同，正規式結尾若少了版本斜線就會誤中。
 */
const REJECTED = [
  [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    '瀏覽器',
  ],
  ['curl/8.7.1', '一般 HTTP 客戶端'],
  [
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +claude-searchbot@anthropic.com)',
    'Claude-SearchBot（索引型）',
  ],
  [
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)',
    'OAI-SearchBot（索引型）',
  ],
  ['Mozilla/5.0 (compatible; Claude-UserAgent/1.0)', '只是前綴相同的 UA'],
  ['Mozilla/5.0 (compatible; Fake-Claude-User/1.0)', '前綴冒充的 UA'],
];

const AGENT_UA = ALLOWED[0][0];

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

function varyTokens(res) {
  return (res.headers.get('vary') ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * 從線上 llms.txt 取一篇真實文章的 md 變體路徑，推回它的 HTML 網址。
 *
 * 不寫死 slug 的理由與 scripts/verify-negotiation.mjs 的同名函式完全相同：文章可能
 * 改名或下架，寫死遲早 404，屆時看起來像偵測壞了、其實是檢查本身過期。
 *
 * 取「第一個」.md 網址的前提也一樣——llms.txt 前段刻意不寫出完整的 .md 範例網址，
 * 所以第一個必然落在文章清單裡。改 src/pages/llms.txt.ts 前段時要一併看本檔、
 * verify-negotiation.mjs 與 verify-headers.mjs 三支。
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

const checks = [];

const article = await resolveArticlePath();

if (article.htmlPath) {
  for (const [ua, name] of ALLOWED) {
    checks.push({
      name: `${name} 命中且行為不變（${article.htmlPath}）`,
      run: async () => {
        const { res, error } = await get(article.htmlPath, { 'User-Agent': ua });
        if (error) return error;
        const problems = [];
        if (res.status !== 200) problems.push(`狀態碼 ${res.status}`);
        // 零行為變更（spec R12）：命中不得改變回應型別。
        if (!contentType(res).startsWith('text/html')) {
          problems.push(`Content-Type 為 ${contentType(res) || '（無）'}，應仍是 HTML`);
        }
        const detected = res.headers.get('x-agent-detected');
        if (detected !== name) problems.push(`x-agent-detected 為 ${detected ?? '（無）'}`);
        const vary = varyTokens(res);
        if (!vary.includes('accept')) problems.push(`Vary 缺 Accept（實際 ${vary.join(', ') || '（無）'}）`);
        if (!vary.includes('user-agent')) {
          problems.push(`Vary 缺 User-Agent（實際 ${vary.join(', ') || '（無）'}）`);
        }
        return problems.length ? problems.join('｜') : null;
      },
    });
  }

  for (const [ua, label] of REJECTED) {
    checks.push({
      name: `${label} 不命中（${article.htmlPath}）`,
      run: async () => {
        const { res, error } = await get(article.htmlPath, { 'User-Agent': ua });
        if (error) return error;
        const problems = [];
        const detected = res.headers.get('x-agent-detected');
        if (detected) problems.push(`不應有 x-agent-detected，實際為 ${detected}`);
        const vary = varyTokens(res);
        if (vary.includes('user-agent')) {
          problems.push(`Vary 不應含 User-Agent，實際為 ${vary.join(', ')}`);
        }
        // 反向斷言不能只驗「沒有多的東西」——既有的 Vary: Accept 也不能被這次改動弄丟。
        if (!vary.includes('accept')) problems.push(`Vary 缺 Accept（實際 ${vary.join(', ') || '（無）'}）`);
        return problems.length ? problems.join('｜') : null;
      },
    });
  }

  // 作用範圍：只有頁面路徑會被偵測（spec R12、D19）。這幾個路徑都不以斜線結尾，
  // pagePathToMdPath 回傳 null，中介層應在讀 UA 之前就已放行。
  for (const path of ['/favicon.png', '/llms.txt', '/sitemap.xml', article.mdPath]) {
    checks.push({
      name: `非頁面路徑不被偵測（${path}）`,
      run: async () => {
        const { res, error } = await get(path, { 'User-Agent': AGENT_UA });
        if (error) return error;
        const detected = res.headers.get('x-agent-detected');
        if (detected) return `不應有 x-agent-detected，實際為 ${detected}`;
        if (varyTokens(res).includes('user-agent')) {
          return `Vary 不應含 User-Agent，實際為 ${res.headers.get('vary')}`;
        }
        return null;
      },
    });
  }

  checks.push({
    // 這一條守的是 spec D17：偵測若寫成 early-return 分支而不是裝飾，同時送
    // Accept: text/markdown 的 agent 會從拿到 markdown 退回拿到 HTML。
    name: `命中 agent 時既有的 Accept 協商契約不變（${article.htmlPath}）`,
    run: async () => {
      const { res, body, error } = await get(article.htmlPath, {
        'User-Agent': AGENT_UA,
        Accept: 'text/markdown',
      });
      if (error) return error;
      const problems = [];
      if (res.status !== 200) problems.push(`狀態碼 ${res.status}`);
      if (res.redirected) problems.push('回應經由重導向達成（應在原網址完成）');
      if (!contentType(res).startsWith('text/markdown')) {
        problems.push(`Content-Type 為 ${contentType(res) || '（無）'}`);
      }
      // 協商回應走正規網址，帶 noindex 等於對頁面本體下架（spec D14）。
      if (res.headers.get('x-robots-tag')) {
        problems.push(`不應有 X-Robots-Tag，實際為 ${res.headers.get('x-robots-tag')}`);
      }
      if (!body.startsWith('---')) problems.push('內容未以 YAML frontmatter 開頭');
      if (res.headers.get('x-agent-detected') !== 'Claude-User') {
        problems.push(`x-agent-detected 為 ${res.headers.get('x-agent-detected') ?? '（無）'}`);
      }
      return problems.length ? problems.join('｜') : null;
    },
  });
} else {
  // 靜默跳過等於這一整批斷言不存在——解析失敗要明確算一項 FAIL，而不是少印幾行。
  checks.push({ name: '可從 llms.txt 取得文章頁路徑（供全部斷言使用）', run: async () => article.error });
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
    'UA 偵測在 functions/_middleware.js。本機要重現需以 wrangler 執行（npm run preview:pages），' +
      'astro preview 不會執行 Pages Functions。',
  );
  console.log(
    '若失敗的是全部項目且狀態碼非 200，先查 zone 的 AI 爬蟲政策（WAF／AI Crawl Control）' +
      '有沒有把這幾個 UA 擋掉（見 docs/specs/seo-perfection.md），那不是中介層的問題。',
  );
  process.exit(1);
}
console.log('全部符合預期。');
