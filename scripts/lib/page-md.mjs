/**
 * 由建置產物 HTML 產生頁面的 markdown 變體（見 docs/specs/agent-markdown.md R10）。
 *
 * 為什麼是「轉換建置產物」而不是像 index.md.ts 那樣手寫一支路由：
 * 關於（544 行）、n8n 資源（301 行）、聯絡（131 行）、隱私權（77 行）的文案全寫在版面裡，
 * 沒有共用來源可讀。要手寫 md 就得先把上千行文案抽成常數，否則兩份副本必定漂移（D8 的教訓：
 * 那種漂移不會讓 build 失敗，只會讓 agent 拿到過期內容）。以最終 HTML 為單一來源則不可能漂移。
 *
 * 這條管線刻意**不涵蓋文章與首頁**：那兩者有手寫來源（原始 markdown、HOME 常數），
 * 通用轉換是品質退步。兩條管線並存是設計，不是待整併的重複。
 */

import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';
import { toYamlFrontmatter } from './md-export.mjs';

/** BaseLayout.astro 的主內容容器；nav 與 footer 是它的兄弟節點，抽它等於同時剔除兩者。 */
const MAIN_OPEN_RE = /<div\b[^>]*\bid=["']main-content["'][^>]*>/i;
const DIV_TAG_RE = /<(\/?)div\b[^>]*>/gi;

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // &amp; 必須最後
}

/**
 * 抽出 `#main-content` 容器的內容。
 *
 * `</div>` 用深度計數配對，不用非貪婪 regex：頁面內每一層巢狀 div 都會讓非貪婪比對提早收尾，
 * 內容被無聲截斷，而產出的 md 看起來仍然是一份合法文件——沒有任何跡象。
 *
 * @param {string} html
 * @returns {string | null}
 */
export function extractMainContent(html) {
  const open = MAIN_OPEN_RE.exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const re = new RegExp(DIV_TAG_RE.source, 'gi');
  re.lastIndex = start;
  let depth = 1;
  let match;
  while ((match = re.exec(html)) !== null) {
    depth += match[1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(start, match.index);
  }
  return null;
}

function metaContent(html, attr, value) {
  const re = new RegExp(`<meta\\b[^>]*\\b${attr}=["']${value}["'][^>]*>`, 'i');
  const tag = re.exec(html)?.[0];
  if (!tag) return '';
  return decodeEntities(tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? '');
}

function linkHref(html, rel) {
  const re = new RegExp(`<link\\b[^>]*\\brel=["']${rel}["'][^>]*>`, 'i');
  const tag = re.exec(html)?.[0];
  if (!tag) return '';
  return decodeEntities(tag.match(/\bhref=["']([^"']*)["']/i)?.[1] ?? '');
}

/**
 * 從 `<head>` 抽 frontmatter 的四個欄位。
 *
 * canonical 與 image 取頁面自己宣告的值而非自行拼接：BaseLayout 已經算過一次
 * （canonical 用 Astro.site + pathname、og:image 有 fallback 到 /cover.webp 的邏輯），
 * 在這裡重算等於複製那套規則，改一邊忘了另一邊就會不一致。
 *
 * @param {string} html
 */
function extractPageMeta(html) {
  return {
    title: decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ''),
    description: metaContent(html, 'name', 'description'),
    canonical: linkHref(html, 'canonical'),
    image: metaContent(html, 'property', 'og:image'),
  };
}

function makeTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  });
  td.use(tables);
  // 圖示 svg 的 <title>、View Transitions 的內聯樣式、Nav 的腳本若被轉成文字，
  // 會變成 agent 要付費閱讀的雜訊——而本功能的全部意義就是省 token。
  td.remove(['script', 'style', 'noscript', 'svg']);
  // turndown 內建的 listItem 規則把前綴寫死成「marker + 三個空白」（原始碼：
  // `options.bulletListMarker + '   '`），完全不受 bulletListMarker 以外的選項調整，
  // 產出的清單會是 `-   項目` 而非慣用的 `- 項目`。覆寫成單一空白，其餘（巢狀縮排、
  // 有序清單起始數字）維持 turndown 原邏輯。
  td.addRule('listItem', {
    filter: 'li',
    replacement(content, node, options) {
      let prefix = `${options.bulletListMarker} `;
      const parent = node.parentNode;
      if (parent.nodeName === 'OL') {
        const start = parent.getAttribute('start');
        const index = Array.prototype.indexOf.call(parent.children, node);
        prefix = `${start ? Number(start) + index : index + 1}. `;
      }
      const isParagraph = /\n$/.test(content);
      content = content.replace(/^\n+/, '').replace(/\n+$/, '\n') + (isParagraph ? '\n' : '');
      content = content.replace(/\n/gm, '\n' + ' '.repeat(prefix.length));
      return prefix + content + (node.nextSibling ? '\n' : '');
    },
  });
  return td;
}

/**
 * 把 markdown 內的站內絕對路徑補上來源網域。
 *
 * md 可能被 agent 搬離本站脈絡後閱讀，`/about/` 在那裡解不開。只處理以 `/` 開頭的目標，
 * 外部連結（https://…）與錨點（#…）原樣保留。
 *
 * @param {string} md
 * @param {string} origin
 */
function absolutizeLinks(md, origin) {
  return md.replace(/\]\((\/[^)\s]*)\)/g, (_, target) => `](${origin}${target})`);
}

/**
 * 產生一份頁面 md（frontmatter + 正文）。
 *
 * @param {string} html 建置產物的完整 HTML
 * @param {string} origin 例如 https://frankchen.tw
 * @returns {string}
 */
export function buildPageMarkdown(html, origin) {
  const main = extractMainContent(html);
  if (main === null) {
    throw new Error(
      '找不到 #main-content 容器：BaseLayout.astro 的主內容區結構可能改了。' +
        '頁面 md 的抽取邏輯與那個 id 耦合，改版面時要一併更新 scripts/lib/page-md.mjs。',
    );
  }
  const meta = extractPageMeta(html);
  const body = absolutizeLinks(
    makeTurndown().turndown(main).replace(/\n{3,}/g, '\n\n').trim(),
    origin,
  );
  const frontmatter = toYamlFrontmatter({
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    image: meta.image,
  });
  return `${frontmatter}\n\n${body}\n`;
}
