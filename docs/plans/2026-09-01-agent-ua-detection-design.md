# agent UA 偵測（第一階段）設計

- 日期：2026-09-01
- domain：`agent-markdown`（brownfield，spec 已 active）
- 上游文件：vault `20-Side/astro-blog/agent-md-UA分流方案_20260730.md`（issue #33 B 案的 UA 分流方案）
- 範圍：只做第一階段（偵測 + 標頭），不做第二階段的 307 重導

## 這次要做什麼

在既有的 `functions/_middleware.js` 裡加一條 UA 白名單判斷：命中即時取用型 agent 時，
在回應加上 `x-agent-detected` 標頭並把 `User-Agent` 併進 `Vary`，其餘行為完全不變。

零行為變更是硬條件。這一階段換到的是三樣東西：一套判斷邏輯、一組守得住它的 CI 斷言、
以及第二階段 307 的插入點。上線之後只要把命中那條出口換成 `return new Response(null, {status: 307, ...})`
就是第二階段，其餘一行不動。

## 動工前的複驗（2026-09-01，打正式站 https://frankchen.tw）

上游文件寫於 2026-07-30，當時 repo 還沒有 runtime 層。動工前逐條複驗，四項全部有結果。

### 一、設計文件的骨架已過期：這是改既有檔案，不是新建

上游骨架寫「新建 `functions/_middleware.ts`」。2026-08-03 PR #48（main `0ede97b`）已上線 Accept
內容協商，`functions/_middleware.js` 現在就存在且在跑。本案是在既有 middleware 裡增加判斷。

### 二、ETag 觀察仍成立，而且比 7/30 更有利

文章頁與首頁皆無 `ETag`／`Last-Modified`，且 `cf-cache-status: DYNAMIC` —— HTML 根本沒進邊緣快取。
2026-08-10 之後 BaseLayout 補的 GA4 config 沒有改變這件事（body 仍被 Bot Fight 的 JS Detections 改寫，
ETag 照樣被丟掉）。

這與 spec D15 當初推翻 D1 所依據的是同一條實測。上游文件列為「唯一剩下的技術風險」的那個情境
——「CDN 已快取不帶 Vary 的版本供 agent 用，就會錯回 HTML」——在正式站的前提目前不成立。
仍須實測（見「上線後待驗」），但預期是確認而非賭。

### 三、UA 觀測面本來就存在，第一階段的定位要修正

上游文件說第一階段要換到「確認 Claude 打自家站時 UA 真的是那串」，並暗示靠 `x-agent-detected` 達成。
這條不成立：`x-agent-detected` 是回應標頭，只送給發請求的 agent，站主看不到；本站是 CF Free 方案，
沒有 Logpush。

但站主不需要它來觀測 UA。專案 MEMORY 的 2026-08-28 盤點就是靠 Cloudflare GraphQL Analytics 的
`httpRequestsAdaptiveGroups` 按 UA 拆的（`Claude-SearchBot` 單日 2,613 次、`nginx-ssl early hints`
557 次、`bastion early hints` 97 次），也就是本站早已有一個看得見 UA 的觀測面，與這次要不要上
middleware 無關。真正的缺口只有保留期：Free 方案的 `httpRequestsAdaptiveGroups` 只查得到 1 天，
`httpRequests1dGroups` 有 30 天但不帶 UA 維度。

因此第一階段的定位改寫為「第二階段的鷹架 + CI 防線」，不再宣稱它提供觀測能力。
「Claude 對本站送什麼 UA」改由一次性實證回答（見「上線後待驗」第 1 項），不必等本案上線。

### 四、`functions/` 進 tsconfig 不能靠全域 checkJs

實測：`npx tsc --noEmit` 現況 exit 0；加 `--checkJs` 變成 361 個錯，其中只有 7 個在 `functions/`，
其餘散在 `astro.config.mjs` 與 `scripts/**`。`scripts/lib/md-path.mjs` 本身在 checkJs 下乾淨
（只有它的 `.test.mjs` 會噴，而測試檔不會進本案的檢查範圍）。

結論是範圍化：另開 `functions/tsconfig.json`，不動根 tsconfig。

## 設計

### middleware：裝飾出口，不新增分支

現有控制流有四條出口：

1. 非 GET/HEAD → `next()`
2. `pagePathToMdPath(pathname) === null`（不是頁面）→ `next()`
3. `!wantsMarkdown(request)` → `withVaryOnAccept(await next())`
4. `wantsMarkdown` 命中 → md 產物（或找不到時退回 3）

UA 判斷加在出口 2 的閘門之後，作用於出口 3 與 4，出口 1、2 維持原樣直接 `next()`
——靜態資產連 UA 標頭都不讀。

實作：閘門之後算一次 `detectAgent(request)`，回傳命中的 agent 名稱或 `null`；
既有的 `withVaryOnAccept(response)` 一般化為 `withVaryAndDetection(response, agent)`，
沿用它現有的「逐一比對既有值再合併、不無條件 append」邏輯（那是為了避免標頭在多次經手後
累積成 `Accept, Accept, Accept`，同時保留 asset 回應可能已帶的 `Accept-Encoding`），
只是要合併的 token 從寫死的 `Accept` 變成 `Accept` 加上命中時的 `User-Agent`。
命中時另外 `set('x-agent-detected', <名稱>)`。

**為什麼是裝飾而不是分支**：若照上游骨架在 `wantsMarkdown` 之前 early-return `next()`，
一個同時送 `Accept: text/markdown` 的 agent 會從拿到 md 退回拿到 HTML，那就不是零行為變更了。
裝飾式改法讓四條出口的內容一字不動，只有標頭多兩項。

### 白名單

只放即時取用型（代使用者即時抓取）：

```
/(?:^|[^\w-])Claude-User(?![\w-])/i
/(?:^|[^\w-])ChatGPT-User(?![\w-])/i
/(?:^|[^\w-])Perplexity-User(?![\w-])/i
```

兩邊都綁邊界，缺一邊就會從一個方向漏；而且兩邊綁的都是「token 到此為止」，不是某個特定字元。
左邊 `(?:^|[^\w-])` 擋掉 `Fake-Claude-User/1.0` 這類前綴冒充；右邊 `(?![\w-])` 擋掉
`Claude-UserAgent` 這類後綴不同的，同時放行 `/`、空格、`;`。

這兩個邊界都是事後補的，各對應一次踩坑，第二階段動這幾條時不要退回去：
左邊界是 Final Review 補的（初版只綁右邊，`Fake-Claude-User/1.0` 會被認成 `Claude-User`）；
右邊界原本寫死 `\/`，上線後實測發現 Claude Code 的 WebFetch 送 `Claude-User (claude-code/…)`
接的是空格，整個被漏掉，才改成通用邊界（見「上線後實測結果」第二節與 spec D20）。

不放 `Claude-SearchBot`、`OAI-SearchBot` 等索引型 —— 它們要建索引，第二階段導去帶 `noindex`
的 md 等於自斷收錄。honestmc-website 那份 12 個白名單是為「被索引」設計的，目的相反，
名單可抄、用途不可抄。

`x-agent-detected` 的值只回命中的名稱（`Claude-User` 等），不回顯整串 UA。

### 路徑範圍：不寫 `SKIP_PATH`

上游骨架有一條 `SKIP_PATH` 正規式。整條刪掉，不寫進去。

`pagePathToMdPath` 的「不以 `/` 結尾就不是頁面」已經完整涵蓋骨架想擋的東西而且更嚴：
`/llms.txt`、`/sitemap.xml`、`/rss.xml`、`/*.md`、`/favicon.png` 全落在 `null` 那條。
骨架那條正規式反而漏了 `/samples/`，又與 `public/_routes.json` 的排除清單
（`/_astro/*`、`/fonts/*`、`/og/*`、`/samples/*`）重複維護。

分工維持現狀：`_routes.json` 管「哪些路徑根本不進 Worker」，middleware 內只管
「進來了的請求裡哪些是頁面」，兩邊不重疊。

### 型別防線

新增 `functions/tsconfig.json`，extends 根那份，開 `checkJs: true`，
`types` 指 `@cloudflare/workers-types`（新增 devDependency）。

必須明確設 `lib` 不含 DOM：不設的話 TS 會依 target 自動帶進 `lib.dom`，
`Response`／`Headers` 會同時來自 DOM 與 workers-types 而打架。

Astro base tsconfig 的 `include` 用 `${configDir}`，extends 之後會解析成 `functions/`，
範圍剛好就是要的，不必自己重寫 include。`env.ASSETS.fetch()`、`context.next()`
從 workers-types 拿到真型別，middleware 內部參數補 JSDoc 標註。

這不是走形式：那 7 個錯裡包含 `request`、`context`、`response` 三個核心參數的 implicit any，
也就是說目前那支檔案的型別檢查等於零。

新增 npm script `check:functions`，接進 `seo-pr.yml`，位置在 `npm test` 之後、`npm run build`
之前，比照既有的 fail fast 原則。

**刻意不做**：不把 `.js` 改寫成 `.ts`（它 import `../scripts/lib/md-path.mjs`，換副檔名要連帶
處理 `allowImportingTsExtensions` 與 Pages 的建置行為，換到的只有語法糖）；
不新增 `wrangler.toml` 產生型別 —— 現代 CF 的做法是 `wrangler types` 讀設定檔生成
`worker-configuration.d.ts`，那條路直接撞「Pages 專案一旦有設定檔，CF 會拿它當建置與執行設定的
唯一來源、蓋掉後台」這條護欄，所以走 `@cloudflare/workers-types` 這個純型別套件。

### 驗證腳本

新增 `scripts/verify-agent-ua.mjs`（`npm run verify:agent-ua`），形狀完全比照
`verify-negotiation.mjs`：預設打正式站、可傳 origin、逐項 PASS/FAIL、任一項不符 exit 1、
文章頁從 llms.txt 第一個 `.md` 網址回推而不寫死 slug（理由同那兩支既有腳本：寫死的 slug
遲早 404，屆時看起來像功能壞了、其實是檢查本身過期）。

CI 接在 `seo-pr.yml` 既有的 wrangler step 之後打 `localhost:8788`，與 `verify:negotiation` 並排。

斷言四組：

- 正向：三個白名單 UA 打文章頁 → 200、`x-agent-detected` 等於命中的名稱、
  `Vary` 同時含 `Accept` 與 `User-Agent`
- 反向（防判準寫太寬）：瀏覽器 UA、Node 預設 UA、`Claude-SearchBot`、`OAI-SearchBot`、
  以及兩種只差一個邊界的冒充字串（`Claude-UserAgent` 後綴、`Fake-Claude-User` 前綴）
  → 一律不得有 `x-agent-detected`，`Vary` 不得含 `User-Agent`
- 範圍：白名單 UA 打 `/favicon.png`、`/llms.txt`、`/sitemap.xml`、`/<slug>.md` 本身
  → 一律不得命中。**不用字型檔當受測對象**：`/fonts/*` 在 `_routes.json` 就被排除、
  根本不進 Worker，拿它斷言是恆真的假綠燈；`/favicon.png` 會進 Worker，驗的才是
  中介層自己的頁面判定
- 零行為變更：白名單 UA 再加 `Accept: text/markdown` 打文章頁 → 仍回 200 md、
  Content-Type 為 markdown、無 `X-Robots-Tag`（既有協商契約沒被動到）

`verify-headers.mjs` 補兩條反向斷言，對應 R12 那句話的兩個子句：以它預設的請求（Node UA）
打首頁時，既不得出現 `x-agent-detected`，`Vary` 也不得含 `User-Agent`。拆成兩條是因為
失效原因不同（中介層判準寫寬 vs zone 層規則附掛），合成一條報出來的訊息分不出該查哪裡。

理由與那支腳本裡「字型檔不得帶 `Link`」同構 —— 正向斷言擋不住「判準寫寬了、每個真人
回應都多背一個標頭」這種靜默退化，而那支打正式站、進日檢，抓得到 zone 層的意外。

CSP 不動，因此 `EXPECTED_CSP_DIRECTIVES` 不需同步。`public/_headers` 一個字都不改。

## 第二階段的優先序（記錄，不在本次動工）

第一階段是裝飾不是分支，所以「UA 與 Accept 誰優先」在這一階段不存在。
第二階段改 307 時，判斷是 **Accept 優先於 UA**。

站主原本的看法是 UA 優先，理由是 Claude-User 送 `*/*`、在 Accept 那條本來就不會命中。
那個觀察正確，但它只證明兩者不衝突，不代表 UA 該排前面。真的有 agent 同時送
`Accept: text/markdown` 時，現有協商已經在正規網址回 200 md，那比 307 更好：
少一趟往返，而且 307 的終點 `/<slug>.md` 帶著 `X-Robots-Tag: noindex`。
UA 分流的定位是補 Accept 分不出來的那批，不是取代它。

## 驗收

第一階段（本次動工範圍）：

- [ ] `functions/` 進 tsconfig，`npx tsc -p functions/tsconfig.json --noEmit` 真的檢查得到
      （驗法：暫時把某個參數的 JSDoc 拿掉，確認會紅）
- [ ] `npm run preview:pages` 上非白名單 UA 行為與現況完全一致，含靜態資產、`/llms.txt`、
      `/sitemap.xml`、`/*.md` 自身
- [ ] `npm run preview:pages` 上既有 Accept 協商 12 項（`verify:negotiation`）未被打破
- [ ] `npm run preview:pages` 上三個白名單 UA 命中並回 `x-agent-detected`
- [ ] `verify:headers` 的 middleware 反向斷言到位且對正式站綠燈
- [ ] `seo-pr.yml` 接上 `check:functions` 與 `verify:agent-ua`

## 上線後實測結果（2026-09-01，main `871948f` 部署後）

三支線上驗證對正式站全綠：`verify:agent-ua` 14/14、`verify:headers`（含新增的兩條反向斷言）、
`verify:negotiation`（既有協商未被打破）。

### 一、Vary 分流雙向實測：通過，但要記住通過的理由

兩個方向都對——瀏覽器先／agent 先各跑一輪，各自拿到該拿的東西，沒有互相污染。

**但六次請求的 `cf-cache-status` 全是 `DYNAMIC`。** 也就是說這一項驗到的是「風險結構上不存在」
（HTML 根本沒進邊緣快取，沒有被快取的錯誤版本可以被端出來），**不是**「CF 邊緣正確依
`Vary: User-Agent` 分流」。後者到目前為止仍然零證據。

這個差別是本項唯一值得記住的東西：哪天有人在 zone 加一條 Cache Rule 開始快取 HTML，
這個測試必須重跑——那時才第一次真的依賴 Vary。不要把本次結果讀成「Vary 分流已驗證可靠」。

驗法（供重跑時照做）：瀏覽器 UA 打某篇文章頁 → 同 URL 換 `Claude-User` UA → 反向順序再一輪。

### 二、UA 實證：推翻了「產品名後面接版本斜線」這個前提

Claude Code 的 WebFetch 對 httpbin 回顯送出的是：

```
User-Agent: Claude-User (claude-code/2.1.252; +https://support.anthropic.com/)
Accept: text/markdown, text/html, */*
```

`Claude-User` 後面接的是**空格**，不是斜線。初版正規式綁死 `Claude-User\/`（依據是 7/30 對
claude.ai `web_fetch` 的 httpbin 觀察 `Claude-User/1.0`），因此正式站實測這串 UA **不命中**——
一個自我標示為 `Claude-User` 的真實 Claude 客戶端被白名單整個漏掉。

已修正：兩側邊界都改成「token 到此為止」（`(?:^|[^\w-])` 與 `(?![\w-])`），不再綁定特定後接字元，
並把 Claude Code 那串補進 `verify-agent-ua.mjs` 的 `ALLOWED` 當回歸測資。寫成 spec 硬規定見 D20。

同一次實測的第二個收穫更重要：Claude Code 送 `Accept: text/markdown`，**它早就命中 R11 的協商、
在正規網址拿到 markdown**（實測 `x-markdown-tokens: 1346`）。這讓本文件先前「第二階段 Accept 應
優先於 UA」的建議從偏好升格為正確性要求——協商回應是 200、走正規網址、不帶 `noindex`，而 307
多一跳且終點帶 `noindex`。已寫進 spec D20。

### 三、仍未做的一項

「**claude.ai 的 `web_fetch` 對 frankchen.tw 送什麼 UA**」仍只有 2026-07-30 的 httpbin 觀察撐著。
上面第二項量到的是 Claude Code 這個客戶端，不是同一個東西。要補這一項得站主在 Claude 對話裡貼一個
自家文章網址讓 `web_fetch` 打一次，**當天**用 CF GraphQL 的 `httpRequestsAdaptiveGroups` 查那一分鐘
的 UA（Free 方案只留 1 天）。

第二階段動工前應該補完——它決定白名單裡 `Claude-User` 那條到底涵蓋幾種客戶端。

## 收尾

- 上游 vault 文件 `20-Side/astro-blog/agent-md-UA分流方案_20260730.md`：
  frontmatter 的 `status` 從 `in-progress` 更新，補「第一階段已上線」與 Vary 實測結果，
  並更正第 97 行的「新建 `functions/_middleware.ts`」與「第一階段換到可觀測訊號」兩處
- 專案 MEMORY 的 open issues 同步（issue #33 條目下的「B 案該改走 UA 分流」那條）
