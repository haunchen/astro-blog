# WordPress 內容遷移 — 設計文件

- **日期**: 2026-05-31
- **Domain**: content-migration
- **Branch**: feat/wp-content-migration
- **來源**: `/Volumes/Data_1T/UserData/Downloads/WordPress.2026-05-31.xml`（WXR, 4.4M）

## 目標

將 WordPress 現有 35 篇已發布文章遷移為 Astro content collection，圖片在地化，frontmatter 對應 schema，並逐篇補齊內容層級 SEO（語意圖檔名、描述性 alt、文章間內連）。

## 來源盤點（實測）

| 項目 | 數據 |
|------|------|
| post(publish) | 35 篇（全部要遷移） |
| attachment | 335（圖片，僅 XML 有 URL，無二進位） |
| 其他 post_type | page×8、nav_menu_item×21、template/block 等，忽略 |
| category nicename | n8n×15、devops×8、tools×4、flutter×4、raspberry-pi×3、uncategorized×1 |
| title >60 | 0 篇 |
| excerpt >160 | 1 篇（161）；另 1 篇空白 |
| featured image | 35 篇全有（`_thumbnail_id`） |
| 內文 `<img>` | 250 張，全在 www.frankchen.tw（WP 仍在線） |
| 含 code block | 19 篇 |

關鍵發現：category nicename 幾乎完美對應 schema enum，schema 落差極小（僅 1 篇 uncategorized、1 篇超字、1 篇空 description）。頁面層 SEO（OG/RSS/sitemap/JSON-LD/canonical）已由 pre-launch-infra 完成，新文章自動繼承。

## 架構：兩階段

### Phase 1 — 確定性遷移腳本

`scripts/migrate-wp.mjs`，五階段管線 + webp：

1. **Parse** — `fast-xml-parser` 解析 WXR，篩 `post_type=post` 且 `status=publish`；建 attachment `id → URL` 對照表（給 featured image）。
2. **Map frontmatter** — 逐篇抽欄位：
   - `title` ← `<title>`（全部 ≤60）
   - `date` ← `pubDate` → `YYYY-MM-DD`
   - `description` ← `excerpt`；>160 句號處截斷 +「…」，仍超硬切 157+「…」；空白取內文首段純文字前 150 字
   - `category` ← nicename（對應 enum）；`uncategorized` → `n8n`
   - `tags` ← `domain="post_tag"` CDATA 名稱陣列
   - `cover` ← featured image，下載後寫 `./images/cover.webp`
   - `draft` ← `false`
   - `updated` ← 省略
3. **Convert HTML→MD** — regex 先清 `<!-- wp:* -->` / `<!-- /wp:* -->`，turndown + 自訂規則：
   - 去 WP class（`has-normal-font-size` 等）、行內 style、空 `<p>`
   - `wp:code` / `<pre><code>` → ` ``` ` fence（WXR 無語言別，輸出無標註，事後手動補）
   - `wp:image` figure → `![alt](./images/img-N.webp)`，alt 取 figcaption/WP alt
   - `<h2>/<h3>` → `##/###`（TOC 抓 h2-h3）
4. **Download + WebP** — featured + 內文 250 張逐一 `fetch` 下載（同 URL 去重）；sharp 轉 `.webp`；存 `src/content/posts/<slug>/images/`。失敗記 URL+篇名、不中斷、標 TODO。
5. **Write** — `src/content/posts/<slug>/index.md`，`<slug>` = WP `post_name`（保留原網址）。每次覆寫整個 `<slug>/` 資料夾（冪等）。

**驗證**：`npm run build`，Zod schema 擋違規即代表 35 篇 frontmatter 全合法（無 test runner，build 是主關卡）。

**新依賴**：`turndown`、`fast-xml-parser`、`sharp`（devDependency）。

### Phase 2 — AI 逐篇加工（Phase 1 build 綠後）

1. 建 manifest：35 篇 `{slug, title, description, category, tags}`，供內連脈絡。
2. 逐篇 spawn subagent，輸入：該篇 Markdown + 各圖在文中上下文 + manifest。輸出三件事：
   - **語意英文檔名**：`img-N.webp` → 如 `certbot-dns-challenge.webp`，rename 檔案 + 改寫 ref
   - **描述性 alt**：依脈絡補中文 alt
   - **內部連結**：內文自然處插入指向其他相關文章 `/<slug>/`，僅真正相關時插、每篇 2-4 條上限、不硬塞
3. 審查：`git diff` / `npm run dev` 抽看（含圖最多、code 最多者）。

## 邊界與錯誤處理

- excerpt 截斷後仍 >160 → 硬切 157+「…」
- 空 alt → Phase 1 用 title 暫補，Phase 2 改寫
- attachment id 找不到 URL → cover 標 TODO + 警告（防呆，理論上 35 篇全有）
- 圖片下載失敗 → 保留原 URL + 標 TODO，不中斷整批
- 現有 `test-markdown-rendering` 不在 WXR 內，不受影響（可保留或之後刪）
- 依賴 WP 仍在線（cutover 未發生）才能下載圖片；先跑 Phase 1

## 不在範圍

- 頁面層 SEO（OG/RSS/sitemap/JSON-LD/canonical）— 已由 pre-launch-infra 完成，自動繼承
- code block 語言別自動偵測 — WXR 無資料，事後手動補
- WP page（8 篇）、留言、選單 — 本次不遷移
