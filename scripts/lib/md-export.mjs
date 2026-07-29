/**
 * 文章 markdown 變體（/<slug>.md）的純轉換工具。
 *
 * 為什麼圖片網址要從「渲染後的 HTML」反推，而不是直接 import 圖檔：
 * Astro 的 image service 會把內文圖轉成 `主幹.資產雜湊_轉換雜湊.webp` 這種
 * 兩段式檔名的變體，未經轉換的原檔根本不會被 emit 到 dist。用 import.meta.glob
 * 取到的 `.src` 是單段雜湊的原檔網址，在 dist 裡不存在——250 處內文圖會全數 404。
 * 渲染一次 <Content/> 再從 HTML 抓 src，拿到的才是實際會被部署的那個網址。
 */

/** `/_astro/<主幹>.<雜湊>.<副檔名>`；主幹不含 `/`，避免比對越界到上一層路徑。 */
const ASTRO_ASSET_RE = /\/_astro\/([^"'\s?/]+?)\.[A-Za-z0-9_-]+\.(?:webp|png|jpe?g|avif|gif|svg)/g;

/** markdown 內指向同目錄 images/ 的相對引用。 */
const RELATIVE_IMAGE_RE = /\.\/images\/([^\s)"']+)/g;

/**
 * 依欄位型別輸出 YAML frontmatter。
 *
 * 字串一律走 JSON.stringify：站上標題大量使用全形冒號與引號，裸寫進 YAML 會在
 * 冒號處解析失敗；JSON 的雙引號字串恰好是合法的 YAML 雙引號純量，逃逸規則相容。
 *
 * @param {Record<string, string | string[] | Date | undefined>} fields
 * @returns {string}
 */
export function toYamlFrontmatter(fields) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (value instanceof Date) {
      lines.push(`${key}: ${value.toISOString().slice(0, 10)}`);
    } else if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => JSON.stringify(v)).join(', ')}]`);
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/**
 * 從渲染後的 HTML 建「檔名主幹 → 建置後網址」對照表。
 *
 * 以主幹（不含雜湊與副檔名）當鍵而非出現順序：同一張圖在文中重複引用不會錯位。
 * 同主幹出現多次（例如 srcset 的多個尺寸）時取第一個，也就是 `src` 上那個預設候選。
 *
 * @param {string} html
 * @returns {Map<string, string>}
 */
export function buildImageUrlMap(html) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const match of html.matchAll(ASTRO_ASSET_RE)) {
    if (!map.has(match[1])) map.set(match[1], match[0]);
  }
  return map;
}

/**
 * 把正文的相對圖片路徑換成絕對網址。
 *
 * 對照表缺項時直接拋錯：這代表某張圖沒有進 image pipeline，靜默留下壞路徑等於
 * 供應一份圖全掛的文件給 agent，寧可讓 build 當場失敗。
 *
 * @param {string} body 文章原始 markdown（不含 frontmatter）
 * @param {Map<string, string>} imageUrls
 * @param {string} origin 例如 https://frankchen.tw
 * @returns {string}
 */
export function rewriteImagePaths(body, imageUrls, origin) {
  return body.replace(RELATIVE_IMAGE_RE, (match, file) => {
    const stem = String(file).replace(/\.[^.]+$/, '');
    const resolved = imageUrls.get(stem);
    if (!resolved) {
      throw new Error(
        `markdown 匯出找不到 ${match} 對應的建置產物（檔名主幹「${stem}」不在 image pipeline 的輸出裡）`,
      );
    }
    return origin + resolved;
  });
}
