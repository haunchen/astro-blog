/**
 * 文章檔案路徑 → 文章 id（去掉 base、去掉 `/index.md` 或 `.md` 後綴）。
 *
 * `astro.config.mjs` 建 sitemap 用的 `POST_LASTMOD`、`scripts/lib/indexnow.mjs` 換算通知網址，
 * 兩邊都需要同一條「檔案路徑 → slug」規則，而且必須逐字一致——這正是 md-path.mjs 檔頭註解
 * 點出的那種「兩邊各寫一份映射最容易靜默走鐘」的情況。漂移的症狀是 IndexNow 去輪詢一個永遠
 * 不會出現在 sitemap 裡的網址，白等十分鐘才逾時，錯誤訊息只說「等待部署逾時」，完全不指向
 * 根因，所以抽成單一函式讓兩邊 import 同一份。
 *
 * 零依賴、純字串運算：`astro.config.mjs` 在建置設定階段就要用到，不能依賴任何要先建置或
 * 執行期才存在的模組（理由與 md-path.mjs 相同）。
 *
 * @param {string} file 相對於專案根的路徑，例如 `src/content/posts/my-post/index.md`
 * @returns {string | null} 非 `src/content/posts/` 下的 `.md` 檔一律回 null
 */
export function postIdFromPath(file) {
  if (typeof file !== 'string') return null;
  const normalized = file.replace(/\\/g, '/');
  if (!normalized.startsWith('src/content/posts/')) return null;
  if (!normalized.endsWith('.md')) return null;
  const id = normalized
    .replace(/^src\/content\/posts\//, '')
    .replace(/\/index\.md$/, '')
    .replace(/\.md$/, '');
  return id === '' ? null : id;
}
