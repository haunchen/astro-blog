---
domain: content-migration
status: active
created: 2026-05-31
last_modified: 2026-06-01
---

# Content Migration

將 WordPress（WXR XML 匯出）的 35 篇已發布文章遷移為 Astro content collection，含內文轉換、圖片在地化、frontmatter 對應，並逐篇補齊內容層級 SEO（語意檔名、alt、內連）。

## Requirements

### R1: 篩選遷移範圍
- **Level**: MUST
- **Description**: 僅遷移 WXR 中 `post_type=post` 且 `status=publish` 的項目（35 篇）；page、attachment、nav_menu_item、template 等其他 post_type 一律忽略。

### R2: Frontmatter 對應 schema
- **Level**: MUST
- **Description**: 每篇產出的 frontmatter 必須通過 `src/content.config.ts` 的 Zod schema：`title`（≤60）、`date`（YYYY-MM-DD）、`description`（≤160）、`category`（n8n/flutter/devops/raspberry-pi/tools 之一）、`tags`（字串陣列）、`cover`（本地圖片）、`draft: false`。

### R3: 分類映射
- **Level**: MUST
- **Description**: WP category nicename 直接映射到 schema enum 同名值；`uncategorized` 的文章映射為 `n8n`。

### R4: description 長度收斂
- **Level**: MUST
- **Description**: `description` 取自 WP `excerpt`；超過 160 字者於最後一個句號處截斷並補「…」，仍超過則硬切 157 + 「…」；空白者取內文首段純文字前 150 字。

### R5: slug 與原網址保留
- **Level**: MUST
- **Description**: 每篇輸出至 `src/content/posts/<slug>/index.md`，`<slug>` = WP `post_name`，使 Astro 路由 `/<slug>/` 與 WordPress 原文網址一致，維持 SEO 連續性。

### R6: 內文 HTML 轉 Markdown
- **Level**: MUST
- **Description**: Gutenberg block HTML 轉為乾淨 Markdown：移除 `<!-- wp:* -->` 註解與 WP 特有 class/行內 style；`<h2>/<h3>` 對應 `##/###`；程式碼區塊轉為 fenced code block；連結、強調、清單、圖片正常轉換。

### R7: 圖片在地化
- **Level**: MUST
- **Description**: featured image 與所有內文 `<img>` 從來源站下載至該篇 `images/` 子資料夾；featured 存為 `cover.*`、內文圖以流水號 `img-N.*` 暫名；frontmatter `cover` 與內文圖片 ref 改寫為本地相對路徑。下載失敗時記錄來源 URL 與篇名、不中斷整批，並於該處標記 TODO。

### R8: 圖片轉 WebP
- **Level**: SHOULD
- **Description**: 在地化圖片以 sharp 轉為 `.webp`，frontmatter `cover` 與內文 ref 指向 `.webp`。

### R9: 語意化英文檔名
- **Level**: SHOULD
- **Description**: 逐篇依圖片在文中的上下文，將 `img-N.webp` 重新命名為語意化英文檔名，並同步改寫內文 ref。

### R10: 描述性圖片 alt
- **Level**: SHOULD
- **Description**: 逐篇依圖片在文中的脈絡，為每張內文圖補上描述性（中文）alt 文字。

### R11: 文章間內部連結
- **Level**: SHOULD
- **Description**: 逐篇於內文自然處插入指向其他相關遷移文章（`/<slug>/`）的內部連結；僅在主題真正相關時插入，每篇上限 2-4 條，不強制塞滿。

### R12: build 驗證
- **Level**: MUST
- **Description**: 遷移完成後 `npm run build` 必須成功；schema 違規（title>60、description>160、category 非 enum、缺 cover）導致 build 失敗即視為遷移未通過。

### R13: 腳本可重跑
- **Level**: SHOULD
- **Description**: Phase 1 腳本對每篇覆寫整個 `<slug>/` 資料夾，重複執行得到一致結果，供日後補匯文章重跑。

## Scenarios

### S1: 只遷移已發布文章
- **Given**: WXR 含 post(publish)×35、page×8、attachment×335、draft/pending 各 1
- **When**: 執行 Phase 1 腳本
- **Then**: 僅產出 35 個 `src/content/posts/<slug>/index.md`，其餘 post_type 不產出
- **Implements**: #R1

### S2: uncategorized 歸入 n8n
- **Given**: 某篇 WP category nicename 為 `uncategorized`
- **When**: 映射 category
- **Then**: frontmatter `category: n8n`
- **Implements**: #R3

### S3: 超長 excerpt 截斷
- **Given**: 某篇 excerpt 長度 161 字
- **When**: 產生 description
- **Then**: description ≤160 且結尾為「…」
- **Implements**: #R4

### S4: 原網址保留
- **Given**: WP 文章 post_name 為 `create-free-ssl-domain-certificates-using-certbot`
- **When**: 遷移完成並 build
- **Then**: 該文於 `/create-free-ssl-domain-certificates-using-certbot/` 可訪問
- **Implements**: #R5

### S5: 內文圖在地化並轉 webp
- **Given**: 內文含 `<img src="https://www.frankchen.tw/wp-content/uploads/.../x.png">`
- **When**: 執行 Phase 1
- **Then**: 圖片下載至該篇 `images/img-1.webp`，內文 ref 改寫為 `./images/img-1.webp`
- **Implements**: #R7, #R8

### S6: 圖片下載失敗不中斷
- **Given**: 某張內文圖 URL 回 404
- **When**: 執行 Phase 1
- **Then**: console 記錄該 URL 與篇名、該圖保留原 URL 並標 TODO、其餘文章與圖片照常完成
- **Implements**: #R7

### S7: schema 違規 build 失敗
- **Given**: 某篇 description 在截斷後仍 >160（理論上不應發生）
- **When**: `npm run build`
- **Then**: build 失敗並指出該篇
- **Implements**: #R12

### S8: 語意檔名與 alt
- **Given**: 某篇含一張 Certbot DNS 驗證流程截圖，暫名 `img-2.webp`、alt 空
- **When**: 執行 Phase 2 逐篇加工
- **Then**: 檔案更名為語意英文（如 `certbot-dns-challenge.webp`）、內文 ref 同步更新、補上描述性中文 alt
- **Implements**: #R9, #R10

### S9: 內部連結只在相關時插入
- **Given**: 一篇 n8n 文章與另一篇 n8n 教學主題相關、與某 Flutter 文章無關
- **When**: 執行 Phase 2
- **Then**: 內文插入指向相關 n8n 文章的連結，不插入無關文章；單篇內連不超過 4 條
- **Implements**: #R11

## Design Decisions

### D1: 自製一次性腳本而非現成工具
- **Decision**: 用自製 Node 腳本（turndown + fast-xml-parser）做 Phase 1，而非 wordpress-export-to-markdown
- **Rationale**: 現成工具不認識本專案 schema（cover image()、category enum、160 限制、per-post images/ 慣例），輸出後仍需 adapter 改寫，可控性反而低；自製腳本完全貼合 schema
- **Date**: 2026-05-31

### D2: 兩階段拆分（確定性 vs 需脈絡判斷）
- **Decision**: Phase 1 為確定性腳本（解析/轉換/下載/webp/frontmatter），Phase 2 為 AI 逐篇加工（語意檔名/alt/內連）
- **Rationale**: 檔名語意化、alt、內連需理解每張圖與每篇文在脈絡中的關係，無法純腳本決定；分離後 Phase 1 可重跑、Phase 2 可逐篇審查
- **Date**: 2026-05-31

### D3: 不依賴 webp 做交付最佳化，僅為縮 repo
- **Decision**: 轉 webp 定位為縮小 repo 原始檔體積，而非交付最佳化
- **Rationale**: Astro 的 image() 與 Markdown 圖片管線在 build 時本就輸出 webp/avif 給瀏覽器；source webp 不影響交付，故 R8 定為 SHOULD
- **Date**: 2026-05-31

### D4: 頁面層 SEO 不在本 domain 範圍
- **Decision**: OG 圖、RSS、sitemap、JSON-LD（BlogPosting/Breadcrumb）、canonical 不在本 domain，遷移文章自動繼承既有 pre-launch-infra 基礎建設
- **Rationale**: 這些已由文章頁模板與既有 endpoint 實作，新文章只要進 collection 即自動套用；本 domain 只補內容層級 SEO（alt/檔名/內連）
- **Date**: 2026-05-31

### D5: 內文圖暫用流水號、Phase 2 再語意化
- **Decision**: Phase 1 內文圖一律以 `img-N` 流水號暫名（捨棄 WP 中文檔名），Phase 2 才改語意英文
- **Rationale**: WP 原檔名為中文+時間戳（如「截圖-2025-05-28-11.08.22.png」），有 import/路徑風險；流水號穩定且與 Phase 2 語意命名解耦
- **Date**: 2026-05-31
