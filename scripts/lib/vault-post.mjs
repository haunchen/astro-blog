/**
 * vault tutorial → posts collection 的純轉換工具。
 *
 * 這一層只做「資料進、資料出」的轉換與判定，完全不碰檔案系統。理由不只是好測：
 * `scripts/sync-from-vault.mjs` 是它的 CLI 消費端，而 Frankify 的 Discord 發文介面
 * 會是第二個（走 in-process MCP server，見 docs/plans/2026-08-19-sync-from-vault-design.md D2）。
 * 檔案 I/O 留在各自的殼裡，中間這段邏輯才共用得了；寫進 CLI 就得抄第二份。
 */

import { toYamlFrontmatter } from './md-export.mjs';

/** 與 src/content.config.ts 的 zod schema 同值。超過是讓 build 失敗，不是警告。 */
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

/**
 * 下限不在 zod schema 裡，但 `verify-seo` 與 `.githooks/pre-commit` 都硬擋 120–160。
 * 只驗上限的話，一篇 86 字的描述會一路過到 CI 才炸（2026-09-01 排程發布就是這樣掛的），
 * 而那時人已經不在現場。既然下游是硬擋，這裡就一起擋。
 */
const DESCRIPTION_MIN = 120;

/**
 * vault 分類 → repo 分類 slug。
 *
 * key 一律是正規化後（trim + 小寫）的值：vault 裡同一個概念中英文並存——
 * `工具與應用` 5 篇對 `tools` 2 篇、`架站與部署` 6 篇對 `devops` 1 篇、
 * `Raspberry Pi` 3 篇對 `raspberry-pi` 1 篇——兩種寫法都得認。
 *
 * `硬體維護` → `hardware` 是 2026-08-19 新增的分類（設計文件 D8），
 * 對應 UPS 系列 4 篇；連動改動在 content.config.ts、site-meta.ts 兩處與 subset-fonts.mjs。
 */
const CATEGORY_MAP = new Map([
  ['n8n', 'n8n'],
  ['架站與部署', 'devops'],
  ['devops', 'devops'],
  ['工具與應用', 'tools'],
  ['tools', 'tools'],
  ['raspberry pi', 'raspberry-pi'],
  ['raspberry-pi', 'raspberry-pi'],
  ['flutter 開發', 'flutter'],
  ['flutter', 'flutter'],
  ['硬體維護', 'hardware'],
  ['hardware', 'hardware'],
]);

/**
 * vault 的 `category` 值轉 repo 的分類 slug；認不得回 null（由呼叫端判為不合規）。
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function mapCategory(raw) {
  if (typeof raw !== 'string') return null;
  return CATEGORY_MAP.get(raw.trim().toLowerCase()) ?? null;
}

/**
 * vault 的 `content_status` 轉 repo 的 `draft` 布林。
 *
 * `published` 回 null 代表「不是這支腳本的事」——那篇已經在站上了，不是不合規。
 * 呼叫端要把這兩種情況分開報，否則每次 dry-run 都會噴一堆假的失敗。
 *
 * @param {unknown} status
 * @returns {boolean | null}
 */
export function mapDraft(status) {
  if (status === 'draft') return true;
  if (status === 'ready') return false;
  return null;
}

/** 外部圖片不搬也不改寫——它不在 vault 裡，複製不到。 */
const EXTERNAL_SRC_RE = /^(?:https?:)?\/\//i;

/** Obsidian wikilink 圖片：`![[任意路徑/x.png|700]]`，尺寸參數可有可無。 */
const WIKILINK_IMAGE_RE = /!\[\[([^\]]+?)\]\]/g;

/** 標準 markdown 圖片：`![alt](path)`。 */
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/**
 * 取路徑的檔名主幹，並把副檔名換成 .webp。
 *
 * 內文圖一律以原檔名主幹落地，只有封面固定叫 cover.webp——後者是 repo 既有慣例
 * （現有 36 篇都是 `./images/cover.webp`），前者若也強制改名，同篇多張圖會撞在一起。
 *
 * @param {string} src
 * @returns {string}
 */
export function toWebpName(src) {
  const base = src.split('/').pop() ?? src;
  const stem = base.replace(/\.[^.]+$/, '');
  return `${stem}.webp`;
}

/**
 * 掃出內文所有本地圖片引用。
 *
 * wikilink 的路徑是相對 vault 根目錄，markdown 的相對路徑是相對該篇 .md 所在目錄——
 * 兩者的解析基準不同，所以 `kind` 必須帶出去給呼叫端，不能在這裡就併成一種。
 *
 * @param {string} body
 * @returns {{kind: 'wikilink' | 'markdown', src: string, alt: string, destName: string}[]}
 */
export function collectImageRefs(body) {
  /** @type {{kind: 'wikilink' | 'markdown', src: string, alt: string, destName: string}[]} */
  const refs = [];

  for (const m of body.matchAll(WIKILINK_IMAGE_RE)) {
    // `|700` 之後是 Obsidian 的顯示尺寸，不是路徑的一部分。
    const src = m[1].split('|')[0].trim();
    if (!src || EXTERNAL_SRC_RE.test(src)) continue;
    refs.push({ kind: 'wikilink', src, alt: '', destName: toWebpName(src) });
  }

  for (const m of body.matchAll(MARKDOWN_IMAGE_RE)) {
    const src = m[2].trim();
    if (!src || EXTERNAL_SRC_RE.test(src)) continue;
    refs.push({ kind: 'markdown', src, alt: m[1], destName: toWebpName(src) });
  }

  return refs;
}

/**
 * 把內文的兩種圖片語法統一改寫成 repo 慣例的 `![alt](./images/<主幹>.webp)`。
 *
 * wikilink 沒有 alt 欄位，轉出來一定是空的——不自動用檔名湊一個，那對 SEO 與無障礙
 * 都是負值，比空著更糟（設計文件 D7）。呼叫端會把空 alt 列成 WARN 讓人回頭補。
 *
 * @param {string} body
 * @returns {string}
 */
export function rewriteImageSyntax(body) {
  return body
    .replace(WIKILINK_IMAGE_RE, (raw, inner) => {
      const src = String(inner).split('|')[0].trim();
      if (!src || EXTERNAL_SRC_RE.test(src)) return raw;
      return `![](./images/${toWebpName(src)})`;
    })
    .replace(MARKDOWN_IMAGE_RE, (raw, alt, src) => {
      const clean = String(src).trim();
      if (!clean || EXTERNAL_SRC_RE.test(clean)) return raw;
      return `![${alt}](./images/${toWebpName(clean)})`;
    });
}

/**
 * 剝掉正文開頭那一個 H1。
 *
 * vault 的稿子習慣在正文第一行重寫一次標題，但 `src/pages/[...slug].astro` 已經用
 * frontmatter 的 title render 過 `<h1>`——照抄進來就是一頁兩個 H1，`verify-seo` 會擋。
 *
 * 只動「第一個非空行」這一個位置：正文中段若真的有 H1，那是作者刻意的層級選擇（雖然少見），
 * 全域刪除會默默改掉文章結構，而這支腳本沒有立場做那個決定。
 *
 * @param {string} body
 * @returns {string}
 */
export function stripLeadingH1(body) {
  return body.replace(/^\s*#[ \t]+[^\n]*\n?/, '');
}

/**
 * 把 vault 的日期欄位轉成 Date。
 *
 * gray-matter 對 `created: 2025-11-24` 這種無引號日期會直接給 Date，但加了引號就是字串，
 * 兩種寫法在 vault 裡都存在，所以這裡兩種都收。
 *
 * @param {unknown} value
 * @returns {Date | null}
 */
export function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(`${value.trim().slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** `--publish-at` 只收這一種寫法——寬鬆解析會讓 `8/28` 這種輸入靜默變成別的日期。 */
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 驗 `--publish-at` 的輸入並轉成 Date。
 *
 * 「今天」由呼叫端傳台北日曆日，與 publish-scheduled 的 `isDue` 同形狀：純函式不讀時鐘，
 * 測試才不必凍結系統時間。回傳 `{date}` 或 `{error}`，兩者只會有一個。
 *
 * 拒收過去日期是刻意的。排一個昨天的日期不會壞事（下一次 cron 就翻掉），但那是「我想現在
 * 就發」的迂迴寫法，而那件事的正解是不加這個 flag、直接落地成非草稿。允許它只會讓
 * 「排程」與「立刻發布」兩個意圖在同一個參數裡混在一起。
 *
 * @param {string} raw
 * @param {string} today 台北日曆日 `YYYY-MM-DD`
 * @returns {{date: Date, error: null} | {date: null, error: string}}
 */
export function parsePublishAt(raw, today) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!ISO_DAY_RE.test(value)) {
    return { date: null, error: `--publish-at 需要 YYYY-MM-DD 格式：${JSON.stringify(raw ?? null)}` };
  }
  const date = new Date(`${value}T00:00:00Z`);
  // 光看 NaN 不夠：V8 對 `2026-02-30T00:00:00Z` 不回 Invalid Date，而是溢位成 3/2。
  // 靜默把排程日挪走兩天是這個參數最糟的失敗方式，所以回寫比對原字串。
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { date: null, error: `--publish-at 不是合法日期：${value}` };
  }
  // 逐日比字串就夠——兩邊都是 YYYY-MM-DD，字典序即時間序。
  if (value < today) {
    return {
      date: null,
      error: `--publish-at 是過去的日期（${value} < 今天 ${today}）。要立刻發布請不要加這個參數。`,
    };
  }
  return { date, error: null };
}

/**
 * 一篇 vault tutorial 轉成 repo 文章的完整判定與轉換。
 *
 * 三種 status，呼叫端要分開處理：
 * - `ok`      — 可以落地，`frontmatter`／`body`／`images` 有值
 * - `skipped` — 不是這支腳本的事（已發布、或不是 tutorial），不算失敗
 * - `blocked` — 資料不合規，`issues` 列出每一條原因
 *
 * 不合規時刻意不中止、也不部分輸出：這批文章的不合規是常態而非例外（11 篇裡 6 篇缺封面），
 * 中止式設計會讓人一次只修得動一篇（設計文件 D6）。
 *
 * @param {Record<string, any>} data vault frontmatter（已由 gray-matter 解析）
 * @param {string} body vault 正文
 * @param {{publishAt?: Date | null}} [options] `publishAt` 有值時排程落地（見下方註解）
 * @returns {{
 *   slug: string | null,
 *   status: 'ok' | 'skipped' | 'blocked',
 *   issues: string[],
 *   warnings: string[],
 *   frontmatter?: Record<string, any>,
 *   body?: string,
 *   images?: {kind: 'wikilink' | 'markdown', src: string, alt: string, destName: string}[],
 *   cover?: {src: string, destName: string} | null,
 * }}
 */
export function transformPost(data, body, options = {}) {
  const slug = typeof data.slug === 'string' && data.slug.trim() ? data.slug.trim() : null;

  if (data.type !== 'tutorial') {
    return { slug, status: 'skipped', issues: [], warnings: ['type 不是 tutorial'] };
  }

  const draft = mapDraft(data.content_status);
  if (draft === null) {
    const reason =
      data.content_status === 'published'
        ? 'content_status 是 published（已在站上）'
        : `content_status 無法對應：${JSON.stringify(data.content_status ?? null)}`;
    return { slug, status: 'skipped', issues: [], warnings: [reason] };
  }

  /** @type {string[]} */
  const issues = [];
  /** @type {string[]} */
  const warnings = [];

  if (!slug) issues.push('缺 slug');

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (!title) issues.push('缺 title');
  else if (title.length > TITLE_MAX) issues.push(`title ${title.length} 字，超過 ${TITLE_MAX}`);

  const description = typeof data.description === 'string' ? data.description.trim() : '';
  if (!description) issues.push('缺 description');
  else if (description.length > DESCRIPTION_MAX || description.length < DESCRIPTION_MIN) {
    issues.push(
      `description ${description.length} 字，需介於 ${DESCRIPTION_MIN}–${DESCRIPTION_MAX}`,
    );
  }

  const category = mapCategory(data.category);
  if (!category) issues.push(`category 無對應：${JSON.stringify(data.category ?? null)}`);

  const date = toDate(data.created);
  if (!date) issues.push('缺 created（或格式無法解析）');

  const coverSrc = typeof data.cover_image === 'string' ? data.cover_image.trim() : '';
  if (!coverSrc) issues.push('缺 cover_image（schema 的 cover 為必填）');
  else if (EXTERNAL_SRC_RE.test(coverSrc)) issues.push('cover_image 是外部網址，無法複製進 repo');

  if (Array.isArray(data.previous_slugs) && data.previous_slugs.length > 0) {
    warnings.push(
      `previous_slugs 有 ${data.previous_slugs.length} 筆，需要人工在 public/_redirects 補 301`,
    );
  }

  const images = collectImageRefs(body);
  const missingAlt = images.filter((img) => !img.alt.trim()).length;
  if (missingAlt > 0) warnings.push(`${missingAlt} 張圖沒有 alt 文字，建議落地後補`);

  if (issues.length > 0) return { slug, status: 'blocked', issues, warnings };

  const updated = toDate(data.updated);
  const tags = Array.isArray(data.tags) ? data.tags.filter((t) => typeof t === 'string') : [];

  // 排程落地：`publishAt` 與 `draft: true` 必須成對出現（content.config.ts 的 refine 在
  // build 期擋），所以這裡不是「照抄 content_status 再附加一個欄位」，而是由 publishAt
  // 反過來決定 draft。vault 的 `ready` 會映成 draft: false，若照抄就會產出一篇 schema
  // 拒收的文章——而最常見的排程對象正好就是 ready 稿。強制翻成 true 並留一條 warning
  // 說明覆寫了什麼，比讓人在 build 失敗時才發現好。
  const scheduled = options.publishAt instanceof Date ? options.publishAt : null;
  if (scheduled && draft === false) {
    warnings.push('content_status 是 ready，但排程落地一律標 draft: true（到期由 cron 翻牌）');
  }

  return {
    slug,
    status: 'ok',
    issues,
    warnings,
    frontmatter: {
      title,
      date,
      // updated 與 created 同日時不輸出：schema 是選填，寫一個與 date 相同的值沒有資訊量。
      ...(updated && date && updated.getTime() !== date.getTime() ? { updated } : {}),
      description,
      category,
      tags,
      cover: './images/cover.webp',
      draft: scheduled ? true : draft,
      // 放最後：翻牌是行級刪除，欄位順序不影響它，但擺在 draft 之後讓「這篇排在哪天」
      // 與「它現在是草稿」在 diff 裡相鄰，人 review 時一眼看得到這組不變量。
      ...(scheduled ? { publishAt: scheduled } : {}),
    },
    body: stripLeadingH1(rewriteImageSyntax(body)),
    images,
    cover: { src: coverSrc, destName: 'cover.webp' },
  };
}

/**
 * 組出可直接落地的 `index.md` 全文。
 *
 * frontmatter 序列化沿用 md-export 的 toYamlFrontmatter：站上標題大量使用全形冒號，
 * 那支的 JSON 逃逸規則正是為此而寫，這裡沒有理由再寫一份會分岔的。
 *
 * @param {Record<string, any>} frontmatter
 * @param {string} body
 * @returns {string}
 */
export function renderPostFile(frontmatter, body) {
  return `${toYamlFrontmatter(frontmatter)}\n${body.replace(/^\n+/, '')}`;
}
