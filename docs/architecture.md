---
domain: architecture
status: active
created: 2026-09-19
last_modified: 2026-09-19
---

# 實作現況：管線與腳本

各條管線目前長什麼樣、哪支檔負責什麼、有哪些行為約束。權威在本檔與程式碼，
專案 MEMORY 只留骨架與選型結論。

內容自 vault 的 `20-Side/astro-blog/MEMORY.md` 移入（2026-09-19），原文未改寫。

## 內容與發布管線

- 發布管線：`migrate-wp.mjs`（既有 35 篇 WXR 一次性）＋ **`sync-from-vault.mjs` 已實作（2026-08-19，main `2483143`）**——`scripts/lib/vault-post.mjs` 純函式＋薄 CLI，預設 dry-run、`--apply` 才寫檔、`--slug` 限定單篇。**只新增不覆蓋**（cutover 後有 4 篇只存在於 repo，覆蓋模式第一次跑就會砍掉；要走 vault 權威得先回灌那 4 篇）；不 commit、不 push、不回寫 vault。**2026-08-24 加 `--publish-at YYYY-MM-DD`**（PR #66 squash merge → main `e51d514`）：落地即排程稿，強制搭 `--slug`（不限定單篇會把當次所有可搬文章排在同一天），且 `draft` 由 `publishAt` 反決定不照抄 `content_status`（schema refine 要求兩者成對，而最常見的排程對象正是映成 `draft: false` 的 ready 稿）。日期驗證拒收過去日期，並回寫比對原字串——V8 對 `2026-02-30T00:00:00Z` 不回 Invalid Date 而是溢位成 3/2。`transformPost` 收第三個 optional 參數、回傳結構不變，既有 26 個測試一行未改（設計文件當初預估的成本沒有發生）。2026-04-17 那版「vault=source of truth、冪等三向比對+`--prune`」的設計**已被取代**。⚠️ **腳本寫好但一篇都還沒 apply**（據 2026-08-19；站上最新文章 2026-08-24 已由排程管線推進到 `claude-code-cross-session-messaging`，但那篇是手動放進 repo 的、不經 sync）。**原卡點「缺 `cover_image`」已於 2026-08-24 解除**：五篇未發布稿的封面全數補齊（含唯一 `content_status: ready` 的 `03-n8n-skills-algorithms`，它與 `04-n8n-skills-engineering` 住 `20-Side/n8n-skills/` 不在內容創作資料夾）。`cover` 仍是 schema 必填，但已無稿件因此卡住（據 2026-08-24）
- 排程發布：`scripts/lib/publish-scheduled.mjs`（純函式：到期判定歸算 Asia/Taipei 日曆日、frontmatter 行級改寫）＋薄 CLI `scripts/publish-scheduled.mjs`＋每日 cron workflow `.github/workflows/publish-scheduled.yml`（08:00 台北，可手動 `dry_run`）。文章寫 `publishAt: YYYY-MM-DD` 並同時 `draft: true`，到期當天翻牌＝`date` 改成 publishAt、`publishAt`／`draft`／早於發布日的 `updated` 三行刪除、正文一字不動，接著 build＋verify:seo 綠了才 commit push 回 main。2026-08-23 上線（PR #65 → main `6e5a0da`）並當天挑真文章走完六步預演（main `2218630`）。**2026-08-24 首次真翻牌驗收六項全綠**：cron run `32677492465`（schedule 觸發、success、48s、台北 08:42）→ main `f912e3d`，diff 只動一檔（+1 −4）、三行如期消失、正文未動，站上 200、封面加五張內文圖全在、OG 圖無 tofu。**管線至此算證明會動**（據 2026-08-24）
- 文章更新紀錄：已上線文章的內容變更寫 frontmatter `changelog: [{date, note}]`，不在正文手寫 blockquote（2026-09-18 起，規則在 repo `CLAUDE.md` 的 “Updating a published post”）。`note` 上限 60 字、回答「改了什麼」不是「改成什麼」。三個出口皆已實測輸出：HTML 的 `ArticleChangelog.astro`（封面下方、`<Content />` 之前）、`/<slug>.md`、`Accept: text/markdown` 內容協商；後兩者由 `md-export.mjs` 的 `changelogToMarkdown()` 輸出成正文最前的 blockquote，**刻意不進 frontmatter**（R2 白名單是契約）也刻意不用 `## 更新紀錄`（避免引用的 agent 以為原文有這節）。代價＝只解析 frontmatter 的 agent 只看得到 `updated` 日期、看不到說明（據 2026-09-18）

## 索引提交

- 索引提交：文章新上線或 `updated` 有變時自動送 IndexNow（Bing／Yandex／Seznam／Naver 一次全收到）。`scripts/lib/indexnow.mjs` 純函式＋`scripts/submit-indexnow.mjs` CLI＋兩個觸發點（`indexnow.yml` 接 push 到 main、`publish-scheduled.yml` 翻牌後自己呼叫——Actions 用 `GITHUB_TOKEN` push 的 commit 不會再觸發 `on: push`）。**Google 端刻意不做**：它沒有給一般文章的官方提交路徑（Indexing API 只支援 JobPosting／BroadcastEvent，sitemap ping 端點 2023 已停用），維持靠 sitemap `lastmod`，收錄狀況交給 seo-monitor 的 URL Inspection 管線。key 是公開檔案 `public/<key>.txt`，**整條管線零 secret**。部署完成的判據是線上 sitemap 的 `lastmod` 等於 `updated ?? date`（不是「回 200」——更新既有文章時舊版本同樣回 200）。id 推導走 `scripts/lib/post-id.mjs`，與 `astro.config.mjs` 的 POST_LASTMOD 共用同一份實作，**勿再各寫一份**（漂移症狀是每次發文白等十分鐘後逾時，錯誤訊息不指向根因）。spec domain `index-submission` active（據 2026-09-18，PR #71 已 squash merge 進 main `a7aba9d`，端到端實證提交回 202、功能已上線）

## 前端與資產管線

- 字型自 host 管線 `scripts/build-font-css.mjs`：掃全站字元集只留交集的 `@font-face` 分片並逐片 subset（主 CSS 284KB→58KB、字型 4.42MB→1.35MB），**檔名含 sha256 前 8 碼**（PR #29 起；先前無雜湊＋一年 immutable ＝ 回訪者拿舊 subset）。**CJK 已於 2026-08-19 從 `FAMILIES` 移除**（死資產確認，見下方 Open issues），現只剩拉丁 15 片 0.16MB；中文由系統字型渲染，`global.css` 仍保留 `'Noto Serif TC'`／`'Noto Sans TC'` 於堆疊中，意義是「系統若裝了就用」、不是 webfont（已加註解）
- Google 偏好來源 CTA（2026-08-21 上線，main `eb50f85`）：`src/components/PreferredSource.astro` 兩個放置點——文章頁側邊欄作者區塊之前一顆橘框 pill、**全站**（含文章頁）footer 社群圖示列尾端一顆四色 G。網址一律走 `site-meta.ts` 的 `preferredSourceUrl(placement: 'aside' | 'footer')`，由 `SITE.url` 取 hostname 組 `q` 與 UTM，repo 內無第二份網域字面值。spec domain `preferred-sources` active（R1–R9）（據 2026-08-21）

## runtime 層

- **2026-08-03 起 repo 有 runtime 層**：`functions/_middleware.js`（Cloudflare Pages Functions）做 Accept 內容協商，`public/_routes.json` 排掉 `/_astro/`、`/fonts/`、`/og/`、`/samples/` 讓靜態資產不進 Worker。仍無 SSR adapter、頁面仍是靜態產物，但「改 `_headers`／`_routes.json`／`BaseLayout` 結構」現在會影響一條本機預設看不見的執行路徑——`astro preview` **不執行** Functions，要驗必須 `npm run preview:pages`（wrangler，已進 CI）。**勿新增 `wrangler.toml`**：Pages 專案一旦有設定檔，CF 會拿它當建置與執行設定的唯一來源、蓋掉後台。`compatibility_date` 改用 `preview:pages` 的啟動參數釘成後台現值 `2026-06-26`，日後後台調整時該參數要一起改，否則本機綠、正式站行為不同的落差會回來

## 線上驗證腳本

- 五支線上驗證腳本（皆對執行中的站台發真實請求）：`verify:headers`（標頭與 `_headers` 意圖一致、CSP 逐指令集合比對）／`verify:robots`（語法＋與 repo 逐字一致）／`verify:assets`（頁面引用的 `_astro`/`fonts` 資產實際抓得到）／`verify:dns-aid`（走 DoH 驗 zone 上的 `_index._agents` 記錄，2026-08-03 起）／`verify:negotiation`（Accept 內容協商，12 項，2026-08-03 起，可傳 origin 打本機 wrangler）。另有 `verify:seo`（build 後掃 dist，30 條規則）。CI 的官方 action 一律追大版本 tag（`checkout`／`setup-node`／`upload-artifact` 皆 `@v7`，2026-08-07 由 v4 直升）；同檔的 Lighthouse／squirrelscan 相反、刻意鎖小版本——那兩支是「尺」，版本一飄分數就不可比（據 2026-08-07）。**共通定位：驗的是 repo 管不到的東西**——zone 層規則會覆寫 `_headers`，DNS 記錄根本不在 repo，Pages Functions 則不在 `astro preview` 的執行路徑上

## 不變量與勿動護欄

改這些地方之前先讀。自 vault 專案 MEMORY 移入（2026-09-19），原文未改寫。

### 標頭與快取

- **`/` ＋ `/*/` 兩條規則＝「所有頁面但不含靜態資產」的慣用寫法（2026-08-03 preview＋正式站雙重實測）**：CF 的 splat 是貪心、跨斜線的**完整**比對，`/*/` 因此等同「以 `/` 開頭且以 `/` 結尾」——本站頁面一律帶結尾斜線（`/about/`、`/category/devops/`、`/<slug>/`），靜態資產一律不帶（`/_astro/x.js`、`/fonts/x.woff2`、`/og/x.png`、`/<slug>.md`），兩者剛好切開。首頁**只**吻合 `/`（`/*/` 展開最短是 `//`），要給首頁的值必須寫完整、不能靠與 `/*/` 合併湊出來。同一區塊內重複寫同名標頭的行為 CF 無明文，多值一律單行逗號分隔
- **改 `_headers` 的 CSP 必同步改 `scripts/verify-headers.mjs` 的 `EXPECTED_CSP_DIRECTIVES`**（據 2026-08-07）。該腳本刻意不從 `_headers` 自動解析——它比對的是「線上實收值 == `_headers` 的意圖」，自動解析會讓兩邊一起錯、驗不到 zone 層覆寫。漏同步的症狀是日檢紅燈＋訊息寫「可能是 zone 層規則注入」，實際注入者是自己。目前無任何 CI 能在 PR 階段抓到這種漂移（見 Open issues）
- **安全標頭的單一來源＝repo `_headers`**（2026-07-28 確立）。zone 上那條停用中的回應標頭轉換規則 `Security Headers` 已**刪除**，理由與備份內容見決策時間線。日後要改安全標頭只改 `_headers`，改完跑 `npm run verify:headers` 對正式站實測
- **`script-src` 已含 `'unsafe-inline'`（2026-08-04 起，AdSense）**。舊認知「全站 0 個內聯 script、script-src 鎖到最嚴、加 `is:inline` 會被 CSP 擋掉」**全部失效**——現在 inline script 一律放行，`assetsInlineLimit: 0` 仍該保持但理由變了（是為了讓日後收緊 CSP 能從「本來就全外部化」出發，不是因為現在會被擋）。另掛 `Content-Security-Policy-Report-Only`（不含 `'unsafe-inline'`）當收緊實驗。**改這一區的註解時要整份掃過**：放寬一個指令會讓 `_headers`、`CLAUDE.md`、`AGENTS.md`、`docs/SEO_GUIDE.md` 裡多處絕對化陳述同時變成假話，2026-08-04 那次花了五輪才清乾淨
- **改 `src/pages/llms.txt.ts` 前段一定要同時看 `verify-headers.mjs` 與 `verify-negotiation.mjs`**：兩支都取「llms.txt 第一個 `.md` 網址」當受測文章，靠的是前段刻意不寫完整範例網址、第一個必然落在文章清單裡。前段補一個 `/index.md` 之類的連結，兩支會同時去打 `/index/` 報假紅燈（站台其實好好的）。三處註解已互相點名（據 2026-08-13）

### 設計系統與元件

- eink hover 僅由 `einkRefresh` 驅動，配它的 `transition 500ms steps(4)` 是 dead transition 可清；連結 base 的 `300ms steps(3)`（hover 直接改 border/bg）有作用勿清
- `CATEGORIES`（口語名稱，`categoryLabel()`）與短標籤（`categoryBadgeLabel()`，OG subset 字型）並存不合併——短標籤字元集靠 `subset-fonts.mjs` 預建字型撐著，合併會讓 OG 圖缺字。短標籤表 2026-08-15 起改名 `CATEGORY_BADGE_LABEL` 且不匯出，三個消費端（`og.ts`、`[...slug].astro`、`ArticleTimeline.astro`）一律走 `categoryBadgeLabel()`（據 2026-08-15）；`subset-fonts.mjs` 硬編 `SITE_NAME` 必須＝SITE.name 否則 OG tofu
- **OG 圖字型目錄走 `astro.config.mjs` 的 `vite.define.__OG_FONT_DIR__` 注入絕對路徑，勿改回 `import.meta.url`**（據 2026-08-15）：`src/utils/og.ts` 在 build 時會被 bundle 進 `dist/chunks/`，那裡的 `import.meta.url` 錨在 `dist`、實測直接 ENOENT；`astro.config.mjs` 不經 bundle，是唯一同時不依賴 process cwd 與 bundle 位置的錨點。配套硬規則：**它的 ambient `declare const` 必須住 `src/env.d.ts`**，因為 `define` 是純文字取代，宣告寫在 `.ts` 會被改寫成 `declare const "/abs/path/": string;` 而語法錯誤——而這個錯只在 `astro dev` 的 esbuild 依賴預掃描浮現，`npm run build` 與 `astro check` 全綠
- **全站鍵盤焦點指示只由 `global.css` 的裸選擇器 `:focus-visible` 供應**（`2px solid var(--color-brand-orange)` + `outline-offset: 2px`，2026-08-22 PR #63 起，spec `design-system` R4）。元件的 scoped CSS 不得各自宣告焦點樣式；唯一豁免是 `#main-content`（skip-link 落點，`:focus` 與 `:focus-visible` 兩邊都 `outline: none`）。**任何位置都不得寫 `:focus { outline: none }` 清瀏覽器預設**——清了之後不支援 `:focus-visible` 的瀏覽器會完全失去焦點指示，比預設外框不好看嚴重得多。顏色取橘不取藍是因為 `404.astro` 的 `.btn` 是 brand-blue 實心底，藍框畫在藍底旁邊切不開（據 2026-08-22）
- **`PreferredSource` 的四色 G 不得帶任何常態透明度**（標誌全程原色，hover 回饋走外層淡橘底）；`preferredSourceUrl` 的參數維持 `'aside' | 'footer'` 字面量聯合、不得放寬成 `string`——那是本功能的編譯期閘門。~~此功能沒有自動化回歸防線（刻意，spec D7）~~ **已於 2026-08-22 補上（PR #63 → main `303fa24`，issue #61）**：`verify-seo.mjs` 斷言文章頁恰 2 個入口（`utm_content` 為 `aside`／`footer`）、非文章頁恰 1 個（`footer`），且每個入口的 `q` 與 `utm_source` 都等於站台網域。原本判定「要補就得破一條硬限制」是誤讀——「不碰 `verify-*`」是 2026-08-21 那輪任務的 scope 限制，PR #62 合併後即失效，而 `verify-seo.mjs` 現成就有需要的 `pages` 與 `articlePathnames` 兩個集合。spec D7 已改寫並保留推翻理由（據 2026-08-22）

### 內容 schema 與發布

- **排程稿的 `publishAt` 必須與 `draft: true` 同時出現**（content schema 的 `.refine()` 在 build 期擋，漏標會讓文章下一次 build 直接上站）；`flipToPublished` 翻牌時若 `updated` 早於 `publishAt` 必須**整行刪掉**而非改寫——`[...slug].astro:72` 的 `dateModified` 是 `updated ?? date`，留著會產出修改時間早於發布時間的 JSON-LD。`publish-scheduled` 的 lib 自己不驗到期，是 CLI 把它跟 `isDue` 配對；第二個消費端（Frankify 介面）接上前要先改成組合入口，否則會把未來日期的稿直接翻掉（據 2026-08-23）
- **vault→repo 的圖片 alt 只從標準 markdown `![alt](path)` 取**，Obsidian wikilink `![[path]]` 取不到也不用檔名湊（`vault-post.mjs:122`, D7），wikilink 裡的 `|文字` 是尺寸參數不是 alt。vault 原稿一律改用標準 markdown 語法（2026-08-23 站主拍板），代價是失去 `|700` 的寬度控制；已同步過的文章要補 alt 只能在 repo 端手改，因為 sync「只新增不覆蓋」（據 2026-08-23）

### 廣告版位

- **廣告只掛文章頁**（`monetization` spec R2，`verify-seo` 有雙向斷言守著）。漏到列表頁或關於我頁會直接打中 CI 稽核的另外三個頁面，紅燈原因看起來卻像與該 PR 無關的效能波動。Best Practices 門檻是**逐頁**的（`TARGETS` 的 `overrides`）：文章頁 75、其餘三頁 100，別為了讓某頁過關就把 `THRESHOLDS` 整體調鬆
- **兩側廣告的收合狀態逐側各一把鍵**（`ads-side-collapsed-left` / `-right`，2026-08-13 起；舊的共用鍵 `ads-side-collapsed` 已棄用）。`SIDE_ADS` 的單一來源在 `src/utils/ads.ts`，按鈕靠 `data-side` 對應、可及名稱逐側不同。spec `monetization` R4／S5 已改為逐側描述、D9 記錄理由（據 2026-08-13）

### agent markdown 與 DNS

- **圖片路徑地雷（勿改回）**：不能用 `import.meta.glob` 拿 `.src`——`dist/_astro/` 的 webp 是「主幹.資產雜湊_轉換雜湊.webp」兩段式（image service 轉換後變體），未轉換原檔根本沒 emit，`.src` 指向的單段雜湊網址在 dist 不存在、35 篇圖會全 404。正解沿用 RSS 那條路（spec D9 Container API）：每篇 `render()` 成 HTML 掃出已解析網址建「主幹→網址」對照表，再改寫 raw body 的 `./images/`。用主幹對應而非出現順序，重複引用不錯位、對照表逐篇建立不跨文汙染
- ⚠️ **啟用 DNSSEC 後「名稱不存在」不能再認 NXDOMAIN**（本次最容易再踩的坑）：CF 對已簽章的 zone 改走 **compact denial of existence（RFC 9824）**——不存在的名稱回 `Status: 0`（NOERROR）＋一筆帶偽型別 `NXNAME` 的 NSEC，**不再回 NXDOMAIN**。因此 `_a2a`／`_mcp` 的不存在性斷言若寫 `Status === 3` 會在名稱確實不存在時系統性誤報。諷刺的是那行 `Status === 3` 正是稍早為「對齊 spec S9 字面（皆為 NXDOMAIN）」而加的——spec 的字面本身描述了一個在 CF＋DNSSEC 下不可能成立的條件。修法＝`isNameAbsent()` 同時認 NXDOMAIN 與 NSEC bitmap 的 `NXNAME`，spec S9 改為描述行為不綁狀態碼。驗證方式＝拿一個隨機不存在的子網域當對照組，回應形狀與 `_a2a` 完全相同即可確認

