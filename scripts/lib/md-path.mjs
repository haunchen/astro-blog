/**
 * 頁面網址與其 markdown 變體之間的路徑映射。
 *
 * 這支刻意零依賴、純字串運算：Pages Functions 的中介層（functions/_middleware.js）與建置後
 * 處理（scripts/lib/page-md.mjs）都要用同一套規則，而前者會被 bundle 進 Cloudflare Worker，
 * 牽連 turndown 或 node:fs 那類 Node 專用相依會讓 bundle 直接失敗。
 *
 * 兩邊各寫一份映射是這個功能最容易靜默走鐘的地方：中介層算出 `/tag/x.md` 而建置產出的是
 * `/tag/x/index.md`，協商會安靜地退回 HTML，所有正向斷言照樣通過。
 */

/**
 * 頁面路徑 → md 變體路徑。
 *
 * 本站所有頁面一律以結尾斜線供應（見 CLAUDE.md 的慣例一節），因此「不以 / 結尾」即代表
 * 這不是頁面——靜態資產、`.md` 本身、`404.html` 都落在這裡，一律回 null 讓呼叫端維持原行為。
 *
 * @param {string} pathname 例如 '/'、'/about/'、'/tag/n8n/'
 * @returns {string | null} 例如 '/index.md'、'/about.md'、'/tag/n8n.md'
 */
export function pagePathToMdPath(pathname) {
  if (typeof pathname !== 'string') return null;
  if (!pathname.startsWith('/')) return null;
  if (!pathname.endsWith('/')) return null;
  if (pathname === '/') return '/index.md';
  return `${pathname.slice(0, -1)}.md`;
}
