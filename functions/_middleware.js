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
 * token 數估算，供 x-markdown-tokens 使用。
 *
 * 是估算不是精確值：中文與英文的 token 密度差很多，這裡取「每 2.5 個字元約一個 token」的
 * 粗略係數，讓 agent 有個量級可以決定要不要抓全文。CF 原生方案的同名標頭一樣是估算值。
 */
function estimateTokens(text) {
  return Math.ceil([...text].length / 2.5);
}

function wantsMarkdown(request) {
  const accept = request.headers.get('accept');
  if (!accept) return false;
  // 只認明確列出的 media type。`*/*`（多數 HTTP 客戶端的預設）不算——那代表「什麼都行」，
  // 依 spec R11，什麼都行的時候給 HTML。
  return accept
    .toLowerCase()
    .split(',')
    .some((part) => part.split(';')[0].trim() === 'text/markdown');
}

/**
 * 補上 `Vary: Accept`。
 *
 * 兩種回應都要帶：Cloudflare 邊緣對 Accept-Encoding 以外的 Vary 不做快取分流，但這個標頭的
 * 對象是瀏覽器與中間層快取——同一個客戶端先後以不同 Accept 取同一個網址時，沒有 Vary 就會
 * 拿到快取裡的另一種表示。
 *
 * 逐一比對既有值而不是無條件 append：重複 append 會讓標頭在多次經手後累積成
 * `Accept, Accept, Accept`。
 */
function withVaryOnAccept(response) {
  const headers = new Headers(response.headers);
  const existing = headers.get('Vary');
  const values = existing ? existing.split(',').map((v) => v.trim().toLowerCase()) : [];
  if (!values.includes('accept') && !values.includes('*')) {
    headers.set('Vary', existing ? `${existing}, Accept` : 'Accept');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

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

  if (!wantsMarkdown(request)) return withVaryOnAccept(await next());

  const asset = await env.ASSETS.fetch(new URL(pageMdPath, url.origin));
  // 找不到 md 產物就退回 HTML，不製造新的 404（spec R11）。正常情況下不會走到這裡——
  // verify-seo 有一條硬斷言要求每個 HTML 頁面都有對應 md。
  if (!asset.ok) return withVaryOnAccept(await next());

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

  // Vary 交給 withVaryOnAccept() 統一合併，不在這裡直接 set：asset.headers 可能已帶
  // 邊緣壓縮設的 Vary（例如 Accept-Encoding），直接 set('Vary', 'Accept') 會整個蓋掉，
  // 走共用函式才能在補上 Accept 的同時保留原有值。
  return withVaryOnAccept(new Response(body, { status: 200, headers }));
};
