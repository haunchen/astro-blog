# 文章區塊版型與結構護欄 — 設計

日期：2026-11-26
Domain：`article-blocks`（新）、`design-system`（delta）

## 問題

文章頁有四個排版問題：

1. 無號列表沒有符號，有號列表沒有數字
2. 常見問題的各題之間沒有視覺邊界
3. 文末的參考資料只是一串連結，和正文沒有區隔
4. 上一篇／下一篇貼著 footer

## 原因查證

- 列表符號：Tailwind preflight 的 `ol,ul,menu{list-style:none}` 清掉符號，`src/styles/global.css` 的
  `.prose ul, .prose ol` 只設了 `padding-left` 與 `margin-bottom`，沒把符號加回來。線上 CSS 確認。
  `privacy-policy.astro` 也用 `.prose`，同樣受影響。
- footer：`[...slug].astro` 的 `.layout-with-aside` padding 是 `0 24px`，底部留白為 0，
  `<footer>` 直接接在 `.article-nav` 之後。
- 第 2、3 項：markdown 產出的 h2、h3、段落是平行的兄弟節點，純 CSS 框不住「一節」或「一題」，
  要在 HTML 樹上包一層。`scripts/lib/rehype-table-caption.mjs`（`astro.config.mjs` 的
  `rehypePlugins`）是既有先例。
- 文章的 `.md` 變體由 `post.body`（原始 markdown）經 `md-export.mjs` 產生，rehype 階段的包裝不會流進去。

## 決策脈絡

### 用 h2 標題文字辨識區塊

比較過三種做法：

- 看 h2 標題文字（採用）：寫稿不必多記語法，Obsidian 裡就是普通標題，`.md` 變體維持乾淨。
  代價是標題用詞要守規矩，交給護欄。
- markdown 內加 directive（`:::faq`）：零誤判，但要多裝 remark-directive，Obsidian 不認得，
  標記還會漏進 `.md` 變體。
- frontmatter 宣告：不污染正文，但標題改名就對不上，同一件事寫兩處。

### 三種區塊

| h2 標題 | 區塊 | 版型 | 節內結構 |
|---------|------|------|---------|
| 含「常見問題」 | 常見問題區塊 | 風琴 | 每個 `###` 是一題；第一題之前的引言留在風琴外 |
| 以「故障排除」開頭 | 故障排除區塊 | 整節內容框起來 | 不限 |
| 等於「參考資料與延伸閱讀」 | 文末連結區塊 | 整節內容框起來 | 不限 |

「常見問題」與「故障排除」同時命中時前者優先，`常見問題與故障排除` 是常見問題區塊。

常見問題區塊與故障排除區塊分開定義的理由：前者是針對整篇文章的問答，放在文末；後者是跟著某個
操作主題走的排錯或注意事項，內容是症狀與處置、常帶程式碼，收進風琴不合適。

### 常見問題區塊用風琴

- 每題是原生 `<details>`，題目的 `<h3>` 留在 `<summary>` 內，不需要 JavaScript
- 預設全部收合，各題獨立開關，可同時展開多題
- 收合的內容仍在 HTML 裡，搜尋引擎讀得到。頁內搜尋命中收合的答案時是否自動展開因瀏覽器而異
  （Chromium 系有此行為，Safari 與 Firefox 待驗證），不當成保證
- RSS（`rss.xml.ts`）用 `sanitizeHtml` 白名單過濾，`details`、`summary`、`div` 不在名單內，
  標籤被剝掉、內容保留，feed 裡仍是平鋪的題目與答案
- 題目仍列在側邊目錄（`TableOfContents` 掃 `.prose h2, .prose h3`），點了捲到題目列但不自動展開。
  自動展開需要 JavaScript，不做

### 題目統一寫成 `###`

不用 `**Q1：…**` 粗體段落：粗體段落和正文的粗體句無法區分，plugin 與護欄只能猜。`###` 是確定的
元素邊界，也是近期文章既有的寫法。編號一併拿掉。

### 文末連結只留一節、一個標題

文末的外部來源與站內延伸閱讀統一成 `## 參考資料與延伸閱讀` 一節。只有其中一種內容的文章也用完整
標題，不為了湊齊標題補內容。

## 產出結構

三種區塊同一原則：h2 留在框外，維持與其他章節相同的標題節奏與目錄行為；框住的是標題底下的內容。

```html
<h2 id="…">常見問題</h2>
<p>引言（有才出現）</p>
<div class="faq-list">
  <details class="faq-item">
    <summary><h3 id="…">題目</h3></summary>
    <div class="faq-answer">答案的所有內容</div>
  </details>
</div>
```

故障排除區塊與文末連結區塊：標題後到下一個 h2 之前的內容包進 `<div class="prose-block">`，
內容原封不動。

## 外觀

- 框：`--color-bg-secondary` 底色、`--color-border-default` 細邊框、`--radius-md` 圓角。
  不用左側橘色粗線，那是 blockquote 與 `ArticleChangelog` 的樣子
- 風琴列：題目在左，右側 `+`，展開後變 `−`，隱藏瀏覽器預設的三角形；列與列之間
  `--color-border-subtle` 分隔線
- 風琴內題目字級 18px（正文 h3 是 22px）
- 開合無過場動畫
- 題目列 hover：背景 10% 品牌橘，依 design-system R1 寫 rgba 與 color-mix 兩行
- 鍵盤焦點：`<summary>` 吃全站的 `:focus-visible`，不另外宣告（design-system R4）
- 列表：`.prose ul` 用 `disc`、第二層 `circle`；`.prose ol` 用 `decimal`；符號與數字顏色
  `--color-text-muted`
- `.layout-with-aside` 底部留白 64px，與 `.list-page` 的上下留白同值，手機版同樣適用。
  `@media (max-width: 1024px)` 那條規則重新宣告了 `padding: 0 24px`，兩條都要改，否則窄螢幕會被蓋回 0
- `style-preview.html` 補上三種區塊與列表符號

## 結構檢查

辨識「這個 h2 屬於哪種區塊」的函式只有一份，rehype plugin 與檢查共用。兩邊各寫一套會出現檢查放行、
頁面卻沒套版型的情況。

檢查是 `scripts/lib/` 下的純函式，輸入 markdown 原文、回傳違規清單，納入 `npm test`。

| 編號 | 違規 |
|------|------|
| E1 | 常見問題區塊內沒有任何 `###` |
| E2 | 常見問題區塊內有整段粗體的段落 |
| E3 | 常見問題區塊內的 `###` 含「總結／結語／下一步／學習路徑／延伸閱讀」 |
| E4 | h2 用了常見問題或故障排除的別名：`常見問答`、不含「常見問題」的 `FAQ`／`Q&A`、以 `疑難排解`／`問題排解` 開頭 |
| E5 | 一篇有兩個以上常見問題區塊 |
| E6 | h2 以「參考資料／參考資源／延伸閱讀／相關文章」開頭但不等於 `參考資料與延伸閱讀`，或該標題出現兩次以上 |

執行點：

1. `sync-from-vault`：dry-run 報告逐篇列出違規；`--apply` 不寫入有違規的那一篇，結束碼非零
2. `.githooks/pre-commit`：檢查 staged 的文章
3. `seo-pr.yml`：掃全部文章

檢查的極限：

- 認不出某個 `###` 是不是真的問題，E3 只是關鍵字比對
- 排錯章節的標題沒用「故障排除」開頭時，檢查不知道它是排錯章節；結果是沒被框，不會報錯

## 既有文章的改動

全部是格式與結構調整，不改論述，不加 changelog、不動 `updated`。改標題會改變該節的錨點，
實作時要 grep 站內是否有連到舊錨點的連結。

### 常見問題區塊（25 節）

標題改名並把清單項目改成 `###`（1）：
samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide。
`## 「NFC 門禁卡」功能問題？` 改成 `## 「NFC 門禁卡」常見問題`；六個清單項目從冒號切開，前半補問號、
拿掉句中粗體後當 `###` 題目，後半當答案，答案內容不動


已是 `###` 寫法、不用動（5）：embeddinggemma-2-chinese-retrieval-mac、hinet-github-slow-cloudflare-warp、
kicad-mcp-autoroute、obs-recording-file-too-large、qwen-image-mac-ssd-streaming

粗體題目改 `###` 並拿掉編號（18）：cloudflare-cache-rules-wordpress、edge-ai-accelerator-sizing、
n8n-canva-oauth-setup、n8n-data-table-csv-export-import、n8n-discord-bot-setup-tutorial、
n8n-line-api-integration-tutorial、n8n-line-discord-telegram-bot-comparison、
n8n-notion-api-integration-tutorial、n8n-telegram-bot-notification-tutorial、
n8n-template-line-bot-upload-system、n8n-wordpress-api-integration-guide、
nextjs-geoip-memory-optimization、nginx-cache-wordpress、security-incidents-php2shell-nodejs-railway、
threads-data-export-tutorial、zeabur-incident-permission-blast-radius、zeabur-shutdown-migration-guide、
zeabur-nginx-subdomain-to-subdirectory（`## 常見問答` 那節，標題同時改成 `## 常見問題`）

清單項目題目改 `###`（1）：n8n-instagram-access-token

誤掛在常見問題底下的 h3 升成 h2（5 篇）：n8n-discord-bot-setup-tutorial、
n8n-telegram-bot-notification-tutorial、n8n-wordpress-api-integration-guide（各有「總結與下一步」
「建議的學習路徑」）、cloudflare-cache-rules-wordpress（「效能測試工具推薦」）、
nextjs-geoip-memory-optimization（「記憶體優化總結與下一步行動」）

### 故障排除區塊（2 節）

- zeabur-nginx-subdomain-to-subdirectory：`## 常見問題排解：Nginx 反向代理設定注意事項` 改成
  `## 故障排除：Nginx 反向代理設定注意事項`
- n8n-canva-oauth-setup：`## 故障排除指南` 不用動

### 文末連結區塊（24 篇）

`## 相關文章` 改名（1）：n8n-credentials-setup-complete-guide（節內的 h3 分組保留）


不用動（7）：cloudflare-cache-rules-wordpress、n8n-line-api-integration-tutorial、
n8n-notion-api-integration-tutorial、n8n-template-line-bot-upload-system、
n8n-wordpress-api-integration-guide、nginx-cache-wordpress、zeabur-nginx-subdomain-to-subdirectory

「及」改「與」（1）：n8n-telegram-bot-notification-tutorial

`## 參考資料` 改名（9）：claude-code-cross-session-messaging、edge-ai-accelerator-sizing、
embeddinggemma-2-chinese-retrieval-mac、gemini-4-argon-release、n8n-canva-oauth-setup、
qwen-image-mac-ssd-streaming、security-incidents-php2shell-nodejs-railway、
zeabur-incident-permission-blast-radius、zeabur-shutdown-migration-guide

`## 延伸閱讀` 改名（4）：n8n-discord-bot-setup-tutorial、n8n-template-store-wish-list、
nextjs-geoip-memory-optimization、wordpress-migrate-to-zeabur

兩節併成一節（2）：n8n-line-discord-telegram-bot-comparison（`延伸閱讀` 與 `參考資料`）、
n8n-data-table-csv-export-import（`參考資源` 與 `延伸閱讀`）

### 不納入

- nfs-version-nfs4-nfs3-io-blocking 的 `### 常見問題：為什麼…`：正文論述的小標
- flutter-secure-storage-android-key-problem 的 `### 階段一：常見問題排除`：除錯歷程的階段名稱
- samsung-wallet…、hinet…、synology… 含「排查」的標題：正文章節

h3 層級的標題不參與辨識，所以前兩者不會被誤判。

## 牽動處

- `CLAUDE.md`：補一節區塊標題約定與檢查執行點，更新 `npm test` 的測試數與涵蓋說明
- vault 的 blog plugin（repo 實作完成、錯誤訊息用詞確定後才寫，不在本分支）：
  - `blog:write` 格式規範：FAQ 那條補上 `## 常見問題` 標題、`### 問題？` 題目、不寫粗體編號；
    另加一條故障排除與 `參考資料與延伸閱讀` 的標題約定
  - `blog:publish` 硬約束：加一條「正文區塊標題必須合規，違規的文章 `sync-from-vault` 不落地，
    要回 vault 原稿改」；流程第 4 步 dry-run 補上「報告的結構違規為零」
  - 檢查邏輯只留在 repo，`preflight.py` 不重寫一份

## 測試策略

- 辨識函式與檢查函式：單元測試，每條違規各有命中與不命中的案例
- rehype plugin：輸入 HTML 樹、斷言輸出結構（引言留在外、節的邊界停在下一個 h2、h3 的 id 保留）
- 全部文章跑一次檢查，確認遷移後零違規
- build 後跑 `verify:seo`，確認 `.md` 變體與既有斷言不受影響
- 瀏覽器實看：風琴開合、鍵盤操作、手機寬度、目錄點擊落點、列表符號、footer 留白
