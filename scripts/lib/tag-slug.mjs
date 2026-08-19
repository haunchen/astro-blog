/**
 * 標籤 → 網址片段。
 *
 * 為什麼需要這支：`[tag]` 路由原本直接拿標籤原文當路徑，產出 `/tag/AI/`、`/tag/Node.js/`、
 * `/tag/Google Cloud/`（實際編碼成 `%20`）。WordPress 時代的 56 個標籤網址因此有 38 個 404
 * 且無 301，既有外部連結與殘存排名一直在漏。
 *
 * 規則刻意對齊 WordPress 的 sanitize_title（小寫、移除點號與撇號、其餘非文數字轉連字號），
 * 因為這件事的目的就是讓舊網址自己復活——規則不對齊，改了也還是 404。
 *
 * 中文標籤保留原文：WP 存的是 percent-encoded 形式（`%e5%b7%a5%e4%bd%9c%e6%b5%81%e7%a8%8b`），
 * 與這裡輸出的原文經瀏覽器編碼後是同一個網址，本來就通，不需要也不應該轉成拼音。
 */

/**
 * 規則推導不出來的 WordPress 舊 slug。
 *
 * WP 的 slug 不是純函數的產物——它有人工編輯與衝突後綴的歷史包袱，同一份匯出檔裡
 * `Node.js` 是 `nodejs`（點號被移除）但 `v0.dev` 是 `v0-dev`（點號變連字號），
 * 靠規則不可能同時滿足。`模板` 的 `template` 更是人工指定的英文 slug，
 * 也因此把英文標籤 `template` 擠成了 `template-2`。
 *
 * 對照來源：`WordPress.2026-05-31.xml` 的 `<wp:tag_slug>`（封存於
 * `Data_1T/UserData/Archives/frankchen-tw-wordpress-封存/`）。
 * 這張表只該為「WP 舊網址對不上」而長，不是給新標籤取別名用的。
 */
export const TAG_SLUG_EXCEPTIONS = new Map([
  ['v0.dev', 'v0-dev'],
  ['模板', 'template'],
]);

/**
 * @param {string} tag 標籤原文，例如 'Google Cloud'、'Node.js'、'工作流程'
 * @returns {string} 網址片段，例如 'google-cloud'、'nodejs'、'工作流程'
 */
export function tagSlug(tag) {
  const exception = TAG_SLUG_EXCEPTIONS.get(tag);
  if (exception !== undefined) return exception;

  return tag
    .toLowerCase()
    // 點號與各式撇號直接移除（WP 行為：`Node.js` → `nodejs`、`Let's` → `lets`），
    // 不轉連字號——轉了會變 `node-js`，對不上舊網址。
    .replace(/[.'’‘"“”]/g, '')
    // 其餘非文數字（空白、斜線、括號…）一律折成單一連字號。
    // \p{L} 涵蓋 CJK，所以中文不會被吃掉。
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 撞名檢查：兩個不同標籤產生同一個 slug 時丟出錯誤。
 *
 * 沒有這道，撞名的表現是「其中一個標籤頁靜默消失」——getStaticPaths 產生重複路徑，
 * 頁面數量少一頁但 build 全綠、sitemap 也不收個別標籤頁，沒有任何一支現有的驗證腳本
 * 會發現。標籤是作者隨手加的，撞名遲早會發生，要讓它在 build 當下就爆。
 *
 * @param {Iterable<string>} tags
 * @throws {Error} 有兩個以上標籤映射到同一個 slug 時
 */
export function assertNoTagSlugCollisions(tags) {
  /** @type {Map<string, string[]>} */
  const bySlug = new Map();
  for (const tag of tags) {
    const slug = tagSlug(tag);
    const bucket = bySlug.get(slug);
    if (bucket) bucket.push(tag);
    else bySlug.set(slug, [tag]);
  }

  const collisions = [...bySlug.entries()].filter(([, tags]) => tags.length > 1);
  if (collisions.length === 0) return;

  const detail = collisions
    .map(([slug, tags]) => `  /tag/${slug}/ ← ${tags.map((t) => `「${t}」`).join('、')}`)
    .join('\n');
  throw new Error(
    `標籤 slug 撞名，這些標籤會共用同一個網址而其中一頁靜默消失：\n${detail}\n` +
      `請改掉其中一個標籤的寫法，或在 tag-slug.mjs 的 TAG_SLUG_EXCEPTIONS 指定不同的 slug。`,
  );
}
