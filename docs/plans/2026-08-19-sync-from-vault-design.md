# vault → blog 發布管線（sync-from-vault）— 設計

- **日期**：2026-08-19
- **來源**：`~/obsidian-vault/20-Side/astro-blog/astro-blog-待辦盤點與必修順序_20260819.md` 必修第 1 件
- **狀態**：**已實作**（2026-08-19）。腳本與測試就緒、dry-run 驗過，但**尚未 `--apply`**——
  站主當日尚未要發文，內容一篇都還沒搬進 repo

## 問題

`sync-from-vault.mjs` 是 2026-04-17 的決策，2026-08-16 查 `git log --all` 確認 repo 內從未存在。
vault 到 blog 之間沒有任何管線，於是：

- vault 有 11 篇已排程的文章（1 篇 `ready`、10 篇 `draft`，排程日 2026-08-17 到 2026-09-21）送不上站
- 站上最新文章停在 2026-01-25（`02-n8n-skills-architecture`），空窗七個月
- `docs/deployment.md:27` 與 `:93` 仍寫著「等 `sync-from-vault.mjs` 跑完 35 篇 WordPress 文章」，
  那是已被 `migrate-wp.mjs` 取代的過期敘述（本案順手更正）

## 現況實測（2026-08-19）

逐篇比對 11 篇的 vault frontmatter 與 `src/content.config.ts` 的 schema：

| 項目 | 結果 |
|------|------|
| `title` 長度 | 24–53 字，全部 ≤ 60 ✅ |
| `description` 長度 | 46–127 字，全部 ≤ 160 ✅ |
| `category` | **6 篇對不上**（中文分類，見下）|
| `cover_image` | **6 篇為空**，而 `cover` 是 schema 必填 |
| 圖片語法 | 兩種混用：相對路徑 `attachments/x.png`、Obsidian wikilink `![[絕對路徑/x.png\|700]]` |
| 內文字數 | 2,113–11,761 字 |

### 分類的實際分布

掃 vault 全部 33 篇 `type: tutorial`：

```
15  n8n            6  架站與部署      5  工具與應用     4  硬體維護
 3  Raspberry Pi   2  tools          1  raspberry-pi   1  devops       1  (空)
```

兩個發現：

1. **同一概念中英文並存**（`工具與應用`／`tools`、`架站與部署`／`devops`、`Raspberry Pi`／`raspberry-pi`）。
   映射表不能只認一種寫法，也不能大小寫敏感
2. **`硬體維護`（4 篇 UPS 系列）在 astro 的 enum 完全沒有對應**。這是唯一真的缺口，其餘都能映射

順帶：vault 的 frontmatter 模板裡有一筆 `category` 寫著
`n8n/Flutter 開發/Raspberry Pi/工具與應用/架站與部署`，可見 vault 的分類體系原本就是照 astro 五類設計的，
`硬體維護` 是後來超出原設計新增的值。

## 範圍

本案（astro-blog repo）：

- `scripts/lib/vault-post.mjs` — 純函式：frontmatter 解析、欄位映射、正文改寫、合規檢查
- `scripts/sync-from-vault.mjs` — 薄 CLI 外殼
- 單元測試（`npm test` 的 glob 自動吃到）

**非目標**（明確不做）：

- 不 commit、不 push、不觸發部署。跑完只改工作區的檔案，發不發是人按 commit 那一刻決定的
- 不回寫 vault（不改 `content_status`、不補發布網址、不搬資料夾）。理由見 D4
- 不做 `--prune`。理由見 D1
- 不做 Discord 發文介面。那是 Frankify repo 的另一案，見「未來的第二消費端」

## 設計決策

### D1 — 只新增，不覆蓋既有文章

有兩份相反紀錄：2026-04-17 決策寫「vault = source of truth」，但 vault 的
`30-Areas/內容創作/README.md`（2026-08-16）寫「正文的 source of truth 在 repo，vault 存的是撰稿過程
與發布後快照」。

**本版採用：腳本只處理「vault 有、repo 沒有」的 slug，既有文章一律不碰。**

不是因為 repo 權威比較對，是因為覆蓋能力有前置條件：cutover 後有 4 篇是直接寫在 repo 的，vault
沒有對應檔。第一次跑覆蓋模式就會砍掉它們。要走 vault 權威得先把那 4 篇回灌 vault，那是獨立的一件事，
不該綁進這次。

`--prune` 同理不做——它是覆蓋語意的延伸，在只新增的模式下沒有意義。

### D2 — 純函式抽 lib，CLI 只是薄殼

沿用 repo 既有慣例（`md-export.mjs`、`og-image.mjs`、`dns-aid.mjs`、`md-path.mjs` 都是這個形狀）。
理由不只是測試方便：**Frankify 的 Discord 發文介面會是同一份邏輯的第二個消費端**，
而 Frankify 走 Bun、以 in-process SDK MCP server 的形狀掛工具（比照它的 position-tracker 與 HA 設定管理）。
邏輯留在 lib 才能被兩邊共用；寫進 CLI 就得抄第二份。

`md-path.mjs` 已經是三消費端共用的先例，這裡是同一個模式。

### D3 — `content_status` 忠實映射到 `draft`

| vault `content_status` | repo `draft` | 效果 |
|---|---|---|
| `draft` | `true` | 進版控、不上站 |
| `ready` | `false` | 進版控，push 後上站 |
| `published` | 不處理（已在站上） |

**`draft` 的文章照樣搬進 repo。** 這點值得說明：搬進來標 `draft: true` 完全安全（不進 listing、不進
sitemap、不出 md 變體，`getPublishedPosts()` 一律擋掉），好處是 10 篇內容先進版控，真要發文時只改一個
布林值。這也正好對上現在的狀態——還沒要發文，但內容應該先被管理起來。

### D4 — 不回寫 vault

vault README 定的契約是「發布後改 `content_status: published`、補網址、資料夾搬到 `02-已發布/`」。
本案不做，兩個理由：

1. 住在 astro-blog repo 的腳本反過來改 vault，語意混亂，且 vault 是 Syncthing 正在同步的檔案
2. 這件事的自然歸屬是 Frankify——它的 cwd 本來就是 vault、寫入根也是 vault

### D5 — 圖片轉 webp

repo 現有 284 張圖全是 webp。vault 是 png/jpg（UPS 那幾篇各有 6–7 張 jpg 照片）。
轉 webp 進 repo，vault 原檔不動。astro:assets 本來就吃得下 png/jpg，所以這純粹是為了 repo 體積與一致性。

### D6 — 不合規就跳過該篇，不中止全部

某篇缺 cover、分類無對應、描述超長 → 列出原因跳過，其他篇照跑，最後印一份摘要。

理由是這批文章的不合規是**常態而非例外**（11 篇裡 6 篇缺 cover、4 篇分類無解），中止式設計會讓人
一次只修得動一篇。

### D7 — 缺 alt 不擋，但列 WARN

Obsidian wikilink 沒有 alt 欄位，轉出來會是 `![](...)`。而缺 alt 正是 Ahrefs 報告 157 筆的那個問題。

不擋的理由：alt 在 repo 內補得動，為它擋掉整篇搬不進來不划算。
不自動生成假 alt 的理由：用檔名湊出來的 alt 對 SEO 與無障礙都是負值，比空著更糟。

### D8 — 新增 `hardware` 分類（2026-08-19 拍板）

`硬體維護` 那 4 篇 UPS 是完整的一個主題，塞進 `tools`（語意是軟體工具）或 `devops` 都是騙讀者。
分類是 URL 的一部分（`/category/hardware/`），之後想改要補 301，現在做最便宜。

連動改動（**四處缺一不可**）：

1. `src/content.config.ts` 的 `category` enum 加 `hardware`
2. `src/utils/site-meta.ts` 的 `CATEGORIES` 加一列（slug + 口語 label）
3. 同檔 `CATEGORY_BADGE_LABEL` 的短標籤加一筆
4. 重跑 `subset-fonts`——短標籤的字元集靠預建字型撐著，漏了會讓 OG 圖那幾個字變成 tofu
   （MEMORY 護欄有記：`CATEGORIES` 與短標籤並存不合併，正是為了這件事）

`/category/` 索引頁與 `/category/[category]/` 都是從 `CATEGORIES` 生的，加完自動就有。

## 轉換規格

### 欄位映射

| vault | repo | 備註 |
|---|---|---|
| `title` | `title` | > 60 字 → 不合規 |
| `description` | `description` | > 160 字 → 不合規 |
| `tags` | `tags` | 直通，空陣列合法 |
| `created` | `date` | |
| `updated` | `updated` | |
| `category` | `category` | 走映射表，無對應 → 不合規 |
| `cover_image` | `cover` | 空 → 不合規；圖檔複製進 `images/` 並轉 webp |
| `content_status` | `draft` | 見 D3 |
| `slug` | 檔案路徑 | → `src/content/posts/<slug>/index.md` |

**丟棄不進 repo**：`type`、`excerpt`、`seo_keywords`、`schedule_*`、`published_*`、`social_post_*`、
`previous_slugs`

（`previous_slugs` 值得單獨記一筆：它其實對應 `public/_redirects` 的 301，但那是另一件事，
本案不處理，遇到有值時列 WARN 提醒人手動加。）

### 分類映射表

```
n8n            → n8n
架站與部署      → devops        devops       → devops
工具與應用      → tools         tools        → tools
Raspberry Pi   → raspberry-pi   raspberry-pi → raspberry-pi
Flutter 開發    → flutter       flutter      → flutter
硬體維護        → hardware      （新增分類，見 D8）
```

比對前先 trim + 轉小寫，讓 `Raspberry Pi` 與 `raspberry-pi` 走同一條。

### 正文改寫

1. Obsidian wikilink `![[任意路徑/x.png|700]]` → `![](./images/x.png)`，尺寸參數丟棄
2. 相對路徑 `attachments/x.png` → `./images/x.png`
3. 圖檔複製到 `src/content/posts/<slug>/images/` 並轉 webp
4. 掃出所有圖片引用，alt 為空的列 WARN（D7）

### CLI

```bash
node scripts/sync-from-vault.mjs                    # dry-run，印會做什麼，不寫檔
node scripts/sync-from-vault.mjs --apply            # 真的寫入
node scripts/sync-from-vault.mjs --slug <slug>      # 只處理單篇
```

**預設 dry-run** 是刻意的：這支腳本的預設行為應該是「告訴我現在狀況如何」，而不是「動手」。
vault 路徑從環境變數讀，預設 `~/obsidian-vault`。

## 未來的第二消費端（Frankify，另案）

Discord 發文介面走 in-process SDK MCP server，包同一份 lib。Frankify 已有現成範式可抄
（position-tracker、HA 設定管理），也已有 croner 排程引擎，因此「到 `schedule_wordpress` 那天自動發」
在基礎設施上是現成的。

實作前要先定的兩件事（本文不決）：

- **發文按鈕誰能按**。Frankify MEMORY 已記載一條相關暴露面：engineer 的授權邊界實際上等於
  「誰能在那個 Discord 頻道發言」。發文是對外不可逆的動作，這條在這裡份量更重
- **要不要真的讓它自動 push**。自動發文出去才發現分類錯或圖沒轉好，補救成本遠高於多按一個確認

還有一個架構張力：Frankify main bot 的寫入根是 vault，而 astro-blog repo 在 `~/Projects/` 下，
屬 workspace profile 的地盤。發文橫跨兩邊（讀 vault、寫 repo、push），權限模型要怎麼開口子是那一案的核心問題。

## 拍板紀錄（2026-08-19）

1. **`硬體維護` → 新增 `hardware` 分類**。見 D8
2. **6 篇缺 `cover_image` → 等站主補圖**，不自動產預設封面。這 6 篇在補圖前一律不合規、不搬
3. **排程日期不動**。等管線通了再一次排

## 這批的實際可搬清單

三項決定套上去之後，11 篇分成兩堆：

**可搬（5 篇，全部是 `draft`）**

| slug | 分類 |
|---|---|
| `claude-code-cross-session-messaging` | tools |
| `ups-battery-buying-guide` | hardware |
| `cyberpower-cp1000pfclcda-battery-replacement` | hardware |
| `apc-back-ups-650-battery-replacement` | hardware |
| `powercom-war-1000ap-battery-replacement` | hardware |

**等補圖（6 篇）**：`n8n-skills-tiered-merging-indexing-algorithm`、
`n8n-skills-nodejs-dynamic-loading-ci-optimization`、`nginx-ssl-certificate-configuration`、
`markitdown-microsoft-file-to-markdown`、`pishrink-raspberry-pi-image-shrink-guide`、
`obsidian-second-brain-with-ai`

⚠️ **注意**：唯一 `content_status: ready` 的 `n8n-skills-tiered-merging-indexing-algorithm`
（排程日 2026-08-17，已過期）正好落在等補圖那堆。因此**這批跑完站上仍不會有新文章**——
可搬的 5 篇全是 `draft`，進 repo 後標 `draft: true` 不上站。

要讓七個月的空窗真的結束，最短路徑是補那一張封面圖。

## 實作中發現的三件事（2026-08-19）

### 1. vault 路徑必須解 symlink，否則靜默掃到零筆

`~/obsidian-vault` 是指向實體儲存位置的 symlink，而 `glob` 預設不跟隨 symlink。第一次 dry-run
掃出 0 篇、**沒有任何錯誤訊息**，看起來就像「vault 裡沒有文章」。修法是 `fs.realpath`。

vault 自己的 hook 系統踩過同一個根因（`isInVault` 字面路徑比對讓六支 hook 全數靜默失效），
這裡是它在另一個 repo 的第二次現身。

### 2. `99-Template/` 要排除

`99-Template/frontmatter-tutorial.md` 帶 `type: tutorial` 但每一欄都空，不排掉的話每次 dry-run
都多一筆「什麼都缺」的假警報。

`.` 開頭目錄則是用規則排除而非列清單——vault 頂層有十幾個，其中 `.stversions`（Syncthing 版本史）
裝的是整份 vault 的歷史快照。逐一列舉遲早會漏，漏掉的表現是同一篇文章冒出好幾個過期版本且不報錯。
（Frankify 的 task-board 踩過這個坑，見該專案 issue #144。）

### 3. `/category/` 索引頁的描述文案還沒提到硬體

`src/pages/category/index.astro` 的 `description` 硬編了「n8n 自動化、架站部署、Flutter、樹莓派與
開發工具」。**現在不改是對的**——那 4 篇 UPS 還是 `draft`，分類頁不會出現 hardware。
但等它們轉成非 draft 上站的那天，這句文案要一起改，否則描述與實際分類對不上。

分類頁本身不用擔心：`/category/[category].astro` 與 `/category/index.astro` 都已經有
「有文章才顯示」的過濾，所以 `CATEGORIES` 多一列不會生出空的分類頁（已驗）。

## 驗收

- `npm test` 綠（新增的 lib 測試被 glob 自動吃到）
- dry-run 對 11 篇輸出正確的合規判定：能搬的列出來，不能搬的列出具體原因
- `--apply` 後 `npm run build` 綠、`npm run verify:seo` 綠
- `draft: true` 的文章確實不出現在 listing／sitemap／`.md` 變體（`verify-seo` 既有的 draft-leak 斷言涵蓋）
