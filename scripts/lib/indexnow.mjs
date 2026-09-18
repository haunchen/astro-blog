/**
 * IndexNow 提交的純函式：判定哪篇該送、換算網址、算預期 lastmod。
 *
 * 與 publish-scheduled.mjs、vault-post.mjs 同一個形狀——git 與網路留在 CLI，這裡只做資料
 * 轉換，才測得動。
 *
 * 設計文件：docs/plans/2026-09-18-index-submission-design.md
 */

/**
 * 文章檔案路徑 → 正規網址。
 *
 * id 的推導規則與 astro.config.mjs 的 POST_LASTMOD 逐字一致（去 base、去 /index.md 或 .md
 * 後綴）。兩邊若漂移，症狀是輪詢一個永遠不會出現在 sitemap 的網址而逾時——失敗方向安全，
 * 但仍然是白等十分鐘，所以規則刻意抄成一樣。
 *
 * 「逐字一致」也包含不替 `src/content/posts/index.md` 這種扁平檔加特例：那個形狀在 Astro
 * 眼中就是 id 為 `index` 的文章，不是首頁。站上 43 篇全是 `<slug>/index.md`，沒有這種檔，
 * 為它加一條規則只會讓兩邊的推導開始分岔。
 *
 * @param {string} file 相對於專案根的路徑，例如 `src/content/posts/my-post/index.md`
 * @param {string} origin 例如 `https://frankchen.tw`
 * @returns {string | null} 非文章檔案回 null
 */
export function postPathToUrl(file, origin) {
  if (typeof file !== 'string') return null;
  const normalized = file.replace(/\\/g, '/');
  if (!normalized.startsWith('src/content/posts/')) return null;
  if (!normalized.endsWith('.md')) return null;
  const id = normalized
    .replace(/^src\/content\/posts\//, '')
    .replace(/\/index\.md$/, '')
    .replace(/\.md$/, '');
  if (id === '') return null;
  return `${origin}/${id}/`;
}

/**
 * 把一個 frontmatter 日期值正規化成 ISO 字串。
 *
 * gray-matter 對裸日期給 Date、對加引號的值給字串，兩種都會出現在既有 43 篇裡。
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
function toIso(raw) {
  if (raw === undefined || raw === null) return null;
  if (!(raw instanceof Date) && typeof raw !== 'string') return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * 這篇在 sitemap 裡應該長什麼樣的 lastmod。
 *
 * 規則就是 astro.config.mjs 的 `new Date(data.updated ?? data.date)`。這個值是「部署完成了
 * 沒」的判據——比對線上 sitemap 的同名欄位。
 *
 * @param {Record<string, unknown>} data frontmatter 物件
 * @returns {string | null}
 */
export function expectedLastmod(data) {
  return toIso(data?.updated ?? data?.date);
}

/**
 * 這篇該不該送出索引提交。
 *
 * 判準是 frontmatter 而不是檔案 diff：錯字與排版修正本來就不該動 `updated`（見 CLAUDE.md
 * 的 changelog 紀律），也就不該告訴搜尋引擎內容變了。
 *
 * @param {Record<string, unknown> | null} before 上一版 frontmatter，新檔為 null
 * @param {Record<string, unknown> | null} after 現況 frontmatter，已刪除為 null
 * @returns {boolean}
 */
export function shouldSubmit(before, after) {
  if (after === null || after === undefined) return false;
  if (after.draft === true) return false;
  if (before === null || before === undefined) return true;
  if (before.draft === true) return true;
  // 型別正規化後再比：Date 與等價字串混用時直接比值會誤判成有改動。
  return toIso(before.updated) !== toIso(after.updated);
}
