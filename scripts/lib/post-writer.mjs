/**
 * post-writer.mjs
 * 輸出組裝層：圖片 URL 替換 + frontmatter 建構
 */

/**
 * 把 markdown 內 http(s) 圖片 URL 換成本地相對路徑。
 * map: { url -> localName }
 * 找不到對應的 URL 保留原 URL 並加 TODO HTML 註解。
 *
 * @param {string} markdown
 * @param {Record<string, string>} map
 * @returns {string}
 */
export function rewriteImageRefs(markdown, map) {
  return markdown.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
    (whole, alt, url) => {
      const local = map[url];
      if (local) return `![${alt}](./images/${local})`;
      return `${whole}<!-- TODO: image download failed, original URL kept -->`;
    }
  );
}

/**
 * 用雙引號包覆字串，並跳脫反斜線、雙引號與換行。
 * 跳脫順序：反斜線必須最先，否則後續跳脫產生的反斜線會被再次跳脫。
 * @param {string} s
 * @returns {string}
 */
function yamlString(s) {
  return '"' + String(s)
    .replace(/\\/g, '\\\\')   // 反斜線先跳脫（必須第一個做）
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    + '"';
}

/**
 * 產出合法 YAML frontmatter 區塊。
 * date 不加引號（Astro Zod z.date() 需要無引號的 YAML date）。
 *
 * @param {{ title: string, date: string, description: string, category: string, tags: string[], cover: string }} params
 * @returns {string}
 */
export function buildFrontmatter({ title, date, description, category, tags, cover }) {
  const tagList = (tags || []).map(yamlString).join(', ');
  return [
    '---',
    `title: ${yamlString(title)}`,
    `date: ${date}`,
    `description: ${yamlString(description)}`,
    `category: ${yamlString(category)}`,
    `tags: [${tagList}]`,
    `cover: ${yamlString(cover)}`,
    'draft: false',
    '---',
    '',
  ].join('\n');
}
