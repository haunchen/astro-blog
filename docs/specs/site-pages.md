---
domain: site-pages
status: active
created: 2026-06-26
last_modified: 2026-07-02
---

# Site Pages

部落格的非文章型頁面與全站導覽：關於我、文章總覽、分類頁、隱私權政策、Header／Footer 站台識別、Tag 頁與標籤雲，以及分類資料的單一來源。

## Requirements

### R1: 關於我頁
- **Level**: MUST
- **Description**: `/about/` 呈現自我介紹、工作經歷、專案經歷、作品集、聯絡資訊五類內容；聯絡 email 為 `frank@frankchen.tw`。頁面不顯示 cover 橫幅主視覺（cover 僅作 og:image，見 #R2）。

### R2: 關於我頁結構化資料與社群圖
- **Level**: SHOULD
- **Description**: `/about/` 的 `<head>` 注入 `Person`/`ProfilePage` JSON-LD（含 jobTitle、skills、社群 sameAs），且 `og:image` 為站台 cover 圖。cover 走 astro:assets，網址是帶內容雜湊的 `/_astro/cover.<hash>.webp`（見 #D19），因此不得寫死路徑字面值——一律取 `site-meta` 的 `OG_FALLBACK`。`og:image:width`/`height`/`type` 須與該圖實際的尺寸與格式相符。

### R3: 文章總覽頁
- **Level**: MUST
- **Description**: `/articles/` 列出全部非草稿文章，以年份分組（年份標題降序、組內由新到舊）的時間軸呈現，每列含日期（MM-DD）、文章標題連結與分類標籤；不分頁、無 client 端篩選、無頂部分類導覽列。

### R4: 分類頁
- **Level**: MUST
- **Description**: 每個「至少有一篇非草稿文章」的分類在 `/category/{slug}/` 提供頁面，以與 `/articles/` 相同的時間軸列表呈現該分類文章並顯示正確篇數；頁頂含分類名與篇數，並提供回鏈至 `/category/`；沒有文章的分類不產生頁面。

### R6: 分類顯示單一來源
- **Level**: MUST
- **Description**: 分類的 slug 與顯示名稱由單一有序清單定義，供首頁分類卡、文章總覽、分類頁共用；文章篇數一律由 content collection 即時計算，不寫死。

### R7: 首頁分類卡正確性
- **Level**: MUST
- **Description**: 首頁分類卡連到有效的 `/category/{slug}/`（不得出現 `/category/deployment/` 之類無對應 enum 的死連結），且顯示即時文章篇數。

### R8: 隱私權政策頁貼合站台現況
- **Level**: MUST
- **Description**: `/privacy-policy/` 僅描述本靜態站實際成立的資料處理方式；不含留言、Gravatar、登入/密碼重設、使用者註冊等本站不存在的功能段落；網站網址標示為 `https://www.frankchen.tw`、聯絡 `frank@frankchen.tw`。

### R9: 導覽無死連結
- **Level**: MUST
- **Description**: 全站 Nav 連結集為 首頁`/`、關於我`/about/`、n8n 相關資源`/n8n-resources/`、文章`/articles/`（下拉分類）、聯絡我`/contact-frank/`，皆有對應頁面（`/n8n-resources/` 以占位頁存在）；Nav 與 Footer 其餘連結（含 `/tag/模板/`）皆可達。

### R10: 聯絡頁
- **Level**: MUST
- **Description**: `/contact-frank/` 提供站內聯絡頁，列出聯絡 email（`frank@frankchen.tw`，mailto 連結）、地點與社群連結；採無後端靜態頁、不含可送出的表單。`/about/` 的聯絡連結指向此站內頁（非外部 WordPress 頁）。

### R11: 分類總覽頁
- **Level**: MUST
- **Description**: `/category/` 提供分類總覽頁，列出每個至少有一篇非草稿文章的分類及其即時篇數（卡片呈現，與首頁探索主題一致），點選導向對應 `/category/{slug}/`；裸 `/category/` 不為 404。

### R12: 時間軸年份分組
- **Level**: SHOULD
- **Description**: 時間軸文章列表依文章發布年份分組，年份標題降序，組內文章由新到舊。

### R13: 分類子頁回鏈
- **Level**: SHOULD
- **Description**: `/category/{slug}/` 提供回到 `/category/` 分類總覽的連結，取代原分類導覽列的切換功能。

### R14: Header 站台識別與收合行為
- **Level**: MUST
- **Description**: Header 顯示圓形頭像、站台標題（連 `/`）與副標，桌機右側為水平 nav（首頁／關於我／n8n 相關資源／文章／聯絡我）；頁面捲離頂部後 header 收合成精簡 sticky bar（小 logo＋nav、隱藏副標）。文章項提供下拉，列固定 3 個分類連結（n8n 相關文章→`/category/n8n/`、Flutter 開發→`/category/flutter/`、Raspberry Pi→`/category/raspberry-pi/`），父項連 `/articles/`。手機收成漢堡，文章分類為子項。

### R15: Footer 站台資訊
- **Level**: MUST
- **Description**: Footer 左區呈現頭像、站台標題、描述段落與一排社群圖示（Threads／Instagram／GitHub／LinkedIn／Email，來源為 `site-meta` 的 `sameAs` 與 `email`，不另寫死）；右區為兩欄策展連結；底部置中 copyright，格式 `Copyright © 2025–{當前年} 法蘭克`（起始 2025、結束年於 build 時動態計算）。

### R16: Tag 頁與標籤雲總覽
- **Level**: MUST
- **Description**: 每個至少有一篇非草稿文章的 tag 在 `/tag/{tag}/` 以時間軸（年份分組）列出該 tag 文章並顯示篇數，並提供回 `/tag/` 的連結；`/tag/` 提供標籤雲總覽，列出全部 tag、字級依篇數分級，點選導向對應 `/tag/{tag}/`。tag 路徑以 URL 編碼處理中文／特殊字。篇數一律即時計算。

### R17: n8n-resources 完整策展頁
- **Level**: MUST
- **Description**: `/n8n-resources/` 由占位頁升級為完整 7 區塊策展頁：(1) 教學文章＝最新 N 篇 `category: n8n` 文章精選並提供「查看全部」連到 `/category/n8n/`（不在本頁重做分頁）(2) 模板分享＝帶「模板」tag 的文章 (3) 推薦學習資源 (4) 推薦進階應用 (5) 推薦模板 (6) Line 社群 (7) 官方資源。前兩區內容由 content collection 即時查詢（篇數/順序不寫死），後五區為策展資料。視覺沿用站台 e-ink 深色系與既有版面骨架。

### R18: 外部策展資料單一來源
- **Level**: MUST
- **Description**: n8n-resources 後五區的外部策展內容（學習資源、進階應用、推薦模板、Line 社群、官方連結）以型別化單一來源檔 `src/data/n8n-resources.ts` 定義；頁面只渲染、不內嵌寫死資料。

### R19: 外部連結開新分頁
- **Level**: SHOULD
- **Description**: n8n-resources 頁面所有指向站外的連結一律以 `target="_blank"` 開新分頁並帶 `rel="noopener noreferrer"`；站內連結（文章、分類、tag）維持同分頁。

### R20: skip-to-content 連結
- **Level**: MUST
- **Description**: 每頁 HTML 的第一個可 focus 元素為「跳到主內容」連結，平時視覺隱藏、鍵盤 focus 時可見，啟用後焦點移至主內容區，鍵盤使用者不需逐一 Tab 過 header 導覽。

### R21: 首頁唯一 h1
- **Level**: MUST
- **Description**: 首頁有且僅有一個 `<h1>`（內容為站名與 tagline），以無障礙隱藏方式存在、不改變版面視覺。補 D18 移除 hero 後首頁無 h1 的 SEO 缺口；hero 不回歸。

### R22: 首頁專案卡連結有效性
- **Level**: MUST
- **Description**: 首頁側欄專案卡的連結一律指向有效目的地（站內頁或外部 URL），不得出現 `#` 佔位死連結；「醫療教學模擬器 G3」卡連至 `/about/`（該頁含完整專案介紹段落）。

## Scenarios

### S1: 造訪關於我頁
- **Given**: 站台已部署
- **When**: 訪客造訪 `/about/`
- **Then**: 看到自我介紹／工作經歷／專案經歷／作品集／聯絡五類內容，聯絡 email 為 frank@frankchen.tw（頁面不顯示 cover 橫幅）
- **Implements**: #R1

### S2: 關於我頁社群分享
- **Given**: 訪客在社群分享 `/about/` URL
- **When**: 檢視 HTML `<head>`
- **Then**: `og:image` 指向站台 cover 圖的雜湊網址（`https://frankchen.tw/_astro/cover.<hash>.webp`），且含 `Person`/`ProfilePage` JSON-LD
- **Implements**: #R2

### S3: 文章總覽時間軸
- **Given**: collection 有跨年份的非草稿文章
- **When**: 訪客造訪 `/articles/`
- **Then**: 文章依年份分組（年份降序）、組內新到舊列出，每列顯示日期、標題連結與分類標籤，頁面無分類導覽列
- **Implements**: #R3, #R12

### S4: 分類頁產出與計數
- **Given**: `devops` 分類有 N 篇非草稿文章、某分類有 0 篇
- **When**: 執行 `npm run build`
- **Then**: 產出 `/category/devops/` 並顯示 N 篇；0 篇的分類不產生頁面
- **Implements**: #R4, #R6

### S5: 首頁分類卡連結
- **Given**: 訪客在首頁點任一分類卡
- **When**: 連結被開啟
- **Then**: 導向有效的 `/category/{slug}/`（非 404），且卡片數字等於該分類即時篇數
- **Implements**: #R6, #R7

### S6: 隱私權政策內容
- **Given**: 訪客造訪 `/privacy-policy/`
- **When**: 閱讀內容
- **Then**: 不出現留言/Gravatar/登入/註冊等本站沒有的功能描述，網址標示為 https://www.frankchen.tw
- **Implements**: #R8

### S7: 導覽列無死連結
- **Given**: 站台已部署
- **When**: 檢視任一頁的 Nav
- **Then**: Nav 連結（首頁／關於我／n8n 相關資源／文章／聯絡我）皆指向存在頁面，無死連結
- **Implements**: #R9

### S8: 造訪聯絡頁
- **Given**: 站台已部署
- **When**: 訪客造訪 `/contact-frank/` 或從 `/about/` 點聯絡連結
- **Then**: 看到聯絡 email（mailto）、地點與社群連結，無可送出的表單
- **Implements**: #R10

### S9: 分類總覽頁
- **Given**: 站台已部署、各分類有不同篇數、某分類 0 篇
- **When**: 訪客造訪 `/category/`
- **Then**: 列出每個有文章的分類及即時篇數（0 篇分類不出現），點選導向對應 `/category/{slug}/`；`/category/` 不為 404
- **Implements**: #R11

### S10: 分類子頁時間軸與回鏈
- **Given**: 某分類有 N 篇非草稿文章
- **When**: 訪客造訪 `/category/{slug}/`
- **Then**: 以時間軸（年份分組）列出該分類 N 篇文章，頁頂顯示分類名與篇數，並有回到 `/category/` 的連結
- **Implements**: #R4, #R13

### S11: Header 高版與收合
- **Given**: 站台已部署
- **When**: 訪客在桌機造訪任一頁並向下捲動
- **Then**: 初始看到高版 header（頭像/標題/副標/水平 nav）；捲離頂部後 header 收合成精簡 sticky bar；hover 文章項展開 3 個分類連結
- **Implements**: #R14

### S12: Footer 站台資訊
- **Given**: 站台已部署
- **When**: 訪客檢視 footer
- **Then**: 看到頭像/標題/描述、5 個社群圖示（連結正確）、兩欄連結皆可達、底部 copyright 年份為 2025–當前年
- **Implements**: #R15

### S13: Tag 標籤雲與個別 tag 頁
- **Given**: collection 有帶 tag 的非草稿文章
- **When**: 訪客造訪 `/tag/` 並點某個 tag（如「模板」）
- **Then**: `/tag/` 顯示標籤雲（字級依篇數）；點選後 `/tag/模板/` 以時間軸列出該 tag 文章與篇數，並可回 `/tag/`
- **Implements**: #R16

### S14: n8n-resources 占位頁
- **Given**: 站台已部署
- **When**: 訪客從 header「n8n 相關資源」或 footer「n8n 學習資源」點選
- **Then**: 到達 `/n8n-resources/` 占位頁（非 404），含簡介與少量真連結
- **Implements**: #R17

### S15: n8n-resources 完整策展頁
- **Given**: collection 有 n8n 文章與帶「模板」tag 的文章、`src/data/n8n-resources.ts` 已定義策展資料
- **When**: 訪客造訪 `/n8n-resources/`
- **Then**: 看到 7 區塊（教學文章精選＋查看全部連 `/category/n8n/`、模板分享、推薦學習資源、推薦進階應用、推薦模板、Line 社群、官方資源），各區內容與卡片正確
- **Implements**: #R17, #R18

### S16: 外部連結開新分頁
- **Given**: 訪客在 `/n8n-resources/`
- **When**: 點任一站外資源連結（YouTube／Threads／模板／官方）
- **Then**: 連結以新分頁開啟並帶 `rel="noopener noreferrer"`；點站內文章／分類連結則同分頁
- **Implements**: #R19

## Design Decisions

### D1: 分類顯示採有序單一來源清單
- **Decision**: 在 `site-meta.ts` 以有序 `CATEGORIES`（slug + 口語 label）取代分散的 `CATEGORY_LABEL`，供首頁／總覽／分類頁共用
- **Rationale**: 消除首頁寫死 label/href（`/category/deployment/`）與 `CATEGORY_LABEL`（'DevOps'）兩套不一致；篇數即時計算避免過時數字
- **Date**: 2026-06-26

### D2: cover.webp 放 public/ 當 OG（不在頁面顯示）
- **Decision**: `cover.webp` 置於 `public/`，當 /about/ 與首頁的 og:image，不走 astro:assets；不在 /about/ 頁面內顯示 cover 橫幅（原 hero 橫幅已移除，僅留標題與 tagline）
- **Rationale**: 已是 1200×630 webp，免再優化；OG 需穩定絕對 URL，public/ 最直接。cover 視覺橫幅依使用者意見移除，保留 OG 供社群分享預覽
- **Date**: 2026-06-26
- **Superseded**: 「放 public/、不走 astro:assets」該半已由 #D19 翻案（2026-08-14）。翻案的不是當初的判斷而是它的前提：Rationale 寫的「已是 1200×630」在寫下時就與實際不符（該檔一直是 4096×2304），而真正致命的是「穩定絕對 URL」——固定檔名換來的穩定，代價是內容一改就沒有任何管道讓已快取的用戶端知道。「不在頁面內顯示 cover 橫幅」該半仍然有效

### D3: 分類頁只為有文章的分類產 path
- **Decision**: `getStaticPaths` 僅輸出至少有一篇非草稿文章的分類
- **Rationale**: 避免空分類頁與首頁連到 404
- **Date**: 2026-06-26

### D4: 文章總覽改時間軸、移除導覽列
- **Decision**: `/articles/` 由「純時序卡片列表 + 分類導覽列」改為「年份分組時間軸 + 無導覽列」；分類過濾入口移至 `/category/` 總覽頁與每列分類標籤
- **Rationale**: 使用者偏好 darrelltw.com/archives/ 式時間軸彙整，掃描更快、版面更輕；分類導覽改由總覽頁承擔
- **Date**: 2026-06-27

### D5: 隱私權政策貼合靜態站、不照搬 WordPress
- **Decision**: 改寫 WordPress 預設政策，移除留言/Gravatar/登入/註冊段落，明述本站不主動蒐集個資、未掛分析
- **Rationale**: 原文描述本站不存在的功能；已 grep 確認無 analytics/gtag，照搬會失真
- **Date**: 2026-06-26

### D6: 聯絡 email 統一 frank@frankchen.tw
- **Decision**: /about/ 聯絡 email 採 `frank@frankchen.tw`，與 `site-meta.ts` 一致，不用 portfolio 的 gmail
- **Rationale**: 全站單一聯絡信箱，避免多版本
- **Date**: 2026-06-26

### D7: 不做 /n8n-resources/，Nav 移除其連結
- **Decision**: 本次不實作 `/n8n-resources/`（repo 無現成素材），並從 Nav 移除該連結
- **Rationale**: 不留死連結；待有素材再另開設計
- **Date**: 2026-06-26
- **Superseded-by**: D17（2026-06-28 以占位頁重新納入）

### D8: 聯絡頁採無後端靜態頁
- **Decision**: `/contact-frank/` 以 email + 社群 + 地點的靜態頁呈現，不接表單後端（不引入 Web3Forms/Turnstile 等服務與金鑰）
- **Rationale**: 純靜態 CF Pages 下表單後端需第三方服務與金鑰、Turnstile 還需 server 驗證；現階段以 email 為主聯絡管道即足夠，避免維護負擔。日後若要表單功能再另開設計
- **Date**: 2026-06-26

### D9: 作品集 n8nManager 維持外部 WordPress 連結
- **Decision**: `/about/` 作品集的 n8nManager 連結維持指向 `https://www.frankchen.tw/n8nmanager`（外部 WordPress 既有頁），不收斂成 `SITE.url`
- **Rationale**: 該頁是 WordPress 站既有的產品介紹頁、Astro 站無此路由；`SITE.url`（`https://frankchen.tw`，非 www）改寫會指向不存在的 Astro 路由變死連結。與 /contact-frank/（改建站內頁）刻意做不同處理：contact 頁有等價內容可內建，n8nmanager 無
- **Date**: 2026-06-26

### D10: 共用 ArticleTimeline 與 CategoryGrid 元件
- **Decision**: 抽 `ArticleTimeline.astro` 供 `/articles/` 與 `/category/{slug}/` 共用；抽 `CategoryGrid.astro` 供首頁探索主題與 `/category/` 總覽共用（取代首頁 inline 卡片）；刪除 `CategoryBar.astro`
- **Rationale**: 兩處列表/卡片邏輯一致，抽元件消除重複、篇數單一來源；`CategoryBar` 已無使用者
- **Date**: 2026-06-27

### D11: 裸 /category/ 改實體總覽頁（非 redirect）
- **Decision**: 裸 `/category/` 建實體分類總覽頁（`src/pages/category/index.astro`），不採 301 導向 `/articles/`
- **Rationale**: 使用者要求 `/category/` 呈現分類與篇數總覽（如首頁探索主題），有獨立資訊價值，勝過 redirect
- **Date**: 2026-06-27

### D12: Header 高版＋IntersectionObserver 收合 sticky
- **Decision**: header 頂部高版，捲離頂部（sentinel + IntersectionObserver）後加 `.scrolled` 收合成精簡 sticky bar；`astro:after-swap` 重新初始化（IO 重入前先 disconnect）
- **Rationale**: 兼顧圖示的高版視覺與「nav 常駐」可用性，避免整塊 105px 一直佔捲動畫面
- **Date**: 2026-06-28

### D13: 文章下拉採 3 項策展清單
- **Decision**: 文章下拉固定列 3 項（n8n 相關文章／Flutter 開發／Raspberry Pi），與 `CATEGORIES` 顯示名解耦
- **Rationale**: 使用者要求照原圖，下拉文字為策展標籤、非自動由分類顯示名產生
- **Date**: 2026-06-28

### D14: Footer 社群／連結由 site-meta 單一來源、欄位標籤為策展文字
- **Decision**: 社群圖示由 `sameAs`＋`email` 推出；footer 欄一標籤沿用原站策展文字（WordPress 架站=devops、App 應用開發=flutter）
- **Rationale**: 單一來源避免漂移；策展標籤比原始分類顯示名更貼合行銷語境
- **Date**: 2026-06-28

### D15: Tag 全生＋/tag/ 文字雲＋URL 編碼
- **Decision**: 每個有文章的 tag 都生 `/tag/{tag}/`；另建 `/tag/` 文字雲總覽；tag 路徑用 `encodeURIComponent`
- **Rationale**: 使用者要求全生＋文字雲；編碼處理中文／特殊字一致性
- **Date**: 2026-06-28

### D16: 網站名與作者名分流定案（大標題）
- **Decision**: 區分兩個身分——網站名 `SITE.name`＝「下班後的工程師筆記」，用於**所有「網站」場合**：header/footer 顯示、`<title>` 後綴（pageTitle）、og:site_name、Organization/WebSite JSON-LD；作者名 `SITE.author`＝「法蘭克｜不典型的軟體工程師」，用於**署名**：文章作者 byline widget、BlogPosting JSON-LD `author`（Person）。`SITE.subtitle`＝「白天上班，下班寫 Side Project。」（header 副標）。移除舊 `SITE.title`（與 name 重複，header/footer 改讀 `SITE.name`）。icon 全面換成 `$ frank _` logo（logo.webp/favicon.png/apple-touch-icon.png）
- **Rationale**: 解 2026-06-28 大標題討論——「法蘭克｜不典型的軟體工程師」是作者名不是網站名，故分頁後綴等網站場合一律用網站名「下班後的工程師筆記」、署名才用作者名。注意 OG 圖（satori）渲染 `SITE.name`，其 subset 字型來源 `subset-fonts.mjs` 硬編同字串，兩者須一致（name 用此值剛好對上、無缺字）
- **Date**: 2026-06-28（同日先誤設 name=作者名，當日更正為此分流）

### D18: 頁面 `<title>` 單一來源 `pageTitle()`、首頁移除 hero
- **Decision**: 於 `site-meta` 加 `pageTitle(t?)` helper（有頁名→「頁名 - SITE.name」、無→純 SITE.name），全頁 `<title>` 改用它，消除原本散落硬編的品牌後綴與首頁第三種名字「法蘭克的技術筆記」；文章頁補品牌後綴。首頁 hero（大 h1＋介紹＋標籤＋捲動提示）移除——tall header 每頁已承載站台識別，hero 與其重複
- **Rationale**: 品牌名單一來源避免再次漂移（Issue #8 教訓）；首頁去重更極簡，header 已提供身分區
- **Date**: 2026-06-28

### D17: 翻案 D7，n8n-resources 以占位頁重新納入 Nav
- **Decision**: 撤銷 D7「不做 /n8n-resources/、Nav 移除」，改以最小占位頁納入 Nav，完整內容另案
- **Rationale**: 使用者要求補做缺頁；占位頁先消除死連結，完整策展頁規模較大另行處理
- **Date**: 2026-06-28

### D19: cover 與 logo 改走 astro:assets 取得內容雜湊檔名
- **Decision**: `cover.webp` 與 `logo.webp` 從 `public/` 搬進 `src/assets/`，以 ESM import 走 astro:assets，輸出為 `/_astro/<name>.<hash>.<ext>` 並吃 `/_astro/*` 的一年 immutable；`site-meta` 新增 `OG_FALLBACK`（src／width／height／type 全部讀 import 回來的 ImageMetadata），`SITE.logo` 改由 `SITE_URL` 接雜湊路徑組成。`public/_headers` 移除這兩條 TTL 規則；`public/_redirects` 補兩條 301 讓舊網址不致 404。`favicon.png` 與 `apple-touch-icon.png` 維持固定檔名不動
- **Rationale**: 固定檔名＋會變的內容，快取正確性只能靠 TTL 撐著，而 TTL 是 Cloudflare zone 可以覆寫的東西——2026-07-23 實際發生過：Cache Rule 把瀏覽器 TTL 一律改成一年，`_headers` 寫的 86400 全被蓋掉，而瀏覽器快取是 Purge Cache 清不到的。站主雖已在 dashboard 修正，但那個修正不在版控、隨時可能再被改掉。改成內容雜湊後，快取正確性不再依賴任何 dashboard 設定。順帶解掉 `og:image:width`/`height` 寫死 4096/2304 的漂移風險（改讀圖檔本身）。favicon 與 apple-touch-icon 例外，是因為瀏覽器與部分爬蟲會直接抓這些慣例路徑而不看 HTML 的 `<link>`，加雜湊會讓它們抓不到，而這兩個檔內容也極少變動
- **Trade-off**: `_redirects` 的 301 目標寫死雜湊檔名，換圖時必須跟著改。以 `verify-seo` 的「`_redirects` 指向 `/_astro/` 的目標都存在於建置產物」擋住忘記改的情況——忘了就在 PR 當場紅燈，不會靜默變成 404
- **Not in scope**: `/og/*.png` 仍是固定檔名。那批圖由 satori 在 build 期產生，頁面與 endpoint 在同一次 build 內渲染且無順序保證，拿不到輸出位元組再回填網址，做法尚未定案（另案追蹤：issue #55）。在定案前，`verify-headers` 釘住它的一週 TTL 實值作為退化偵測
- **Date**: 2026-08-14
