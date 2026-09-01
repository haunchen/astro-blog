/**
 * Accept 內容協商：同一網址依 Accept 供應 HTML 或 markdown（見 docs/specs/agent-markdown.md R11）。
 *
 * 為什麼是 Pages Functions 而不是 Cloudflare 原生的 Markdown for Agents：本站 zone 是 Free 方案，
 * 原生功能與 Snippets 都是 Pro 起。而且即使升級也不會採用——原生方案在邊緣做通用 HTML→md 轉換
 * 並附 JSON-LD（spec D3 刻意排除），本站的文章 md 則是作者手寫的原始 markdown，兩者並存等於
 * 同一份內容有兩種互相打架的表示。
 *
 * HTML 永遠是預設。只有 Accept 明確含 text/markdown 才切換，瀏覽器不受影響。
 */

import { pagePathToMdPath } from '../scripts/lib/md-path.mjs';

/**
 * 這支中介層實際用到的 context 欄位。
 *
 * 刻意不用 workers-types 的 `PagesFunction<Env>`：那個名稱跨大版本未必穩定，而本檔
 * 只用得到 context 的三個欄位，寫成 typedef 反而把「這支到底依賴什麼」講清楚了。
 * `Request`／`Response`／`Fetcher` 這幾個核心型別才是從 workers-types 來的。
 *
 * @typedef {{
 *   request: Request,
 *   next: () => Promise<Response>,
 *   env: { ASSETS: Fetcher },
 * }} MiddlewareContext
 */

/**
 * token 數估算，供 x-markdown-tokens 使用。
 *
 * 是估算不是精確值：中文與英文的 token 密度差很多，這裡取「每 2.5 個字元約一個 token」的
 * 粗略係數，讓 agent 有個量級可以決定要不要抓全文。CF 原生方案的同名標頭一樣是估算值。
 *
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil([...text].length / 2.5);
}

/**
 * 即時取用型 AI agent 的 UA 白名單（spec R12、D18）。
 *
 * 只放代使用者即時抓取的 agent。刻意不放 Claude-SearchBot／OAI-SearchBot 這類索引型：
 * 它們是為了建索引而來，而第二階段會把命中者導向帶 X-Robots-Tag: noindex 的
 * /<slug>.md，等於自斷收錄。honestmc-website 有一份 12 個 AI 代理的白名單，但那份是
 * 為「被索引」設計的，目的相反——名單可以參考，用途不可照抄。
 *
 * 正規式結尾的 `\/` 綁的是版本斜線（實際 UA 長相為 `Claude-User/1.0`）。少了它，
 * `Claude-UserAgent` 這種只是前綴相同的字串也會命中。
 *
 * 開頭的 `(?:^|[^\w-])` 綁左邊界：真實 UA 裡這個 token 前面永遠是字串開頭或
 * 空白／`; `（例如 `compatible; Claude-User/1.0`），落在 `[^\w-]` 內，不受影響；
 * 但 `Fake-Claude-User/1.0` 這種前綴冒充，`Claude` 前面接的是 `-`，落在 `[\w-]`
 * 範圍內因此被排除，不會被誤認成 `Claude-User`。
 */
const AGENT_UA = [
  { name: 'Claude-User', pattern: /(?:^|[^\w-])Claude-User\//i },
  { name: 'ChatGPT-User', pattern: /(?:^|[^\w-])ChatGPT-User\//i },
  { name: 'Perplexity-User', pattern: /(?:^|[^\w-])Perplexity-User\//i },
];

/**
 * 認出請求是不是白名單內的即時取用型 agent。
 *
 * 回傳命中的名稱而非整串 UA：x-agent-detected 要回答的只有「是誰」，把請求者送來的
 * 原始字串原封回顯出去沒有必要。
 *
 * @param {Request} request
 * @returns {string | null} 命中的 agent 名稱，未命中為 null
 */
function detectAgent(request) {
  const ua = request.headers.get('user-agent');
  if (!ua) return null;
  return AGENT_UA.find(({ pattern }) => pattern.test(ua))?.name ?? null;
}

/**
 * @param {Request} request
 * @returns {boolean}
 */
function wantsMarkdown(request) {
  const accept = request.headers.get('accept');
  if (!accept) return false;
  // 只認明確列出的 media type。`*/*`（多數 HTTP 客戶端的預設）不算——那代表「什麼都行」，
  // 依 spec R11，什麼都行的時候給 HTML。
  return accept
    .toLowerCase()
    .split(',')
    .some((part) => {
      const [type, ...params] = part.split(';');
      if (type.trim() !== 'text/markdown') return false;
      // `text/markdown;q=0` 依 RFC 9110 是「明確不接受」，與整個 media type 沒出現在
      // Accept 裡等價。不看 q 就會把明確拒絕讀成明確要求——實務上少見，但那是這支
      // 唯一會「客戶端說不要卻還是給」的路徑。
      //
      // 只判斷「是不是 0」，不做完整的 qvalue 排序：本站只有兩種表示，而 HTML 是預設，
      // 排序影響不到結果。q 值解不出數字（畸形標頭）時同樣落回 HTML——spec R11 要的
      // 就是「不確定就給 HTML」。
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return q === undefined || Number(q.slice(2)) > 0;
    });
}

/**
 * 統一收尾：合併 Vary，並在命中白名單 agent 時標記 x-agent-detected（spec R12）。
 *
 * 兩種回應都要帶 `Vary: Accept`：Cloudflare 邊緣對 Accept-Encoding 以外的 Vary 不做快取
 * 分流，但這個標頭的對象是瀏覽器與中間層快取——同一個客戶端先後以不同 Accept 取同一個
 * 網址時，沒有 Vary 就會拿到快取裡的另一種表示。命中 agent 時再加 User-Agent，同理。
 *
 * 逐一比對既有值而不是無條件 append：重複 append 會讓標頭在多次經手後累積成
 * `Accept, Accept, Accept`；而整個 set 掉又會蓋掉 asset 回應可能已帶的 Accept-Encoding。
 *
 * UA 偵測做成「裝飾既有出口」而不是新增一條分支，是為了守住 R12 的零行為變更：若命中
 * 就 early-return next()，一個同時送 Accept: text/markdown 的 agent 會從拿到 markdown
 * 退回拿到 HTML（spec D17）。
 *
 * @param {Response} response
 * @param {string | null} agent detectAgent() 的結果
 * @returns {Response}
 */
function withVaryAndDetection(response, agent) {
  const headers = new Headers(response.headers);
  const existing = headers.get('Vary');
  const values = existing ? existing.split(',').map((v) => v.trim().toLowerCase()) : [];
  if (!values.includes('*')) {
    const missing = (agent ? ['Accept', 'User-Agent'] : ['Accept']).filter(
      (token) => !values.includes(token.toLowerCase()),
    );
    if (missing.length > 0) {
      headers.set('Vary', existing ? `${existing}, ${missing.join(', ')}` : missing.join(', '));
    }
  }
  if (agent) headers.set('x-agent-detected', agent);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** @param {MiddlewareContext} context */
export const onRequest = async (context) => {
  const { request, next, env } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  const url = new URL(request.url);

  // 補 Vary 的閘門是「這個路徑是不是頁面」，不是「Accept 想不想要 markdown」：
  // 協商契約（spec MODIFIED R5）只涵蓋同一頁面的 HTML／markdown 兩種表示，
  // pagePathToMdPath 回傳 null 就代表這不是頁面（靜態資產、.md 本身、404.html）。
  // 這些路徑在 public/_headers 有刻意調過的快取秒數，多一個 Vary: Accept 會讓
  // 瀏覽器快取改以 Accept 分鍵——<img> 與 fetch() 送的 Accept 不同，可能造成
  // 同一資源被重複下載，因此完全不碰標頭，原樣交還。
  const pageMdPath = pagePathToMdPath(url.pathname);
  if (pageMdPath === null) return next();

  // UA 偵測放在「這是不是頁面」閘門之後：靜態資產、.md 路徑本身與 404.html 連 UA 標頭
  // 都不必讀，也不得帶 x-agent-detected（spec R12 的作用範圍與 R11 相同）。
  const agent = detectAgent(request);

  if (!wantsMarkdown(request)) return withVaryAndDetection(await next(), agent);

  const asset = await env.ASSETS.fetch(new URL(pageMdPath, url.origin));
  // 找不到 md 產物就退回 HTML，不製造新的 404（spec R11）。正常情況下不會走到這裡——
  // verify-seo 有一條硬斷言要求每個 HTML 頁面都有對應 md。
  if (!asset.ok) return withVaryAndDetection(await next(), agent);

  const body = await asset.text();
  const headers = new Headers(asset.headers);
  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  headers.set('x-markdown-tokens', String(estimateTokens(body)));
  // ASSETS.fetch 會套用 _headers 規則，所以這裡拿到的回應帶著給 /*.md 設的
  // X-Robots-Tag: noindex。那條規則的用途是防 /<slug>.md 與 /<slug>/ 被判重複內容；
  // 協商回應走的是正規網址本身，帶上它等於叫搜尋引擎不要收錄頁面本體（spec D14）。
  headers.delete('X-Robots-Tag');
  // body 已重新讀出，長度交給 runtime 重算。
  headers.delete('Content-Length');

  // Vary 交給 withVaryAndDetection() 統一合併，不在這裡直接 set：asset.headers 可能已帶
  // 邊緣壓縮設的 Vary（例如 Accept-Encoding），直接 set('Vary', 'Accept') 會整個蓋掉，
  // 走共用函式才能在補上 Accept 的同時保留原有值。
  return withVaryAndDetection(new Response(body, { status: 200, headers }), agent);
};
