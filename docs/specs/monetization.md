---
domain: monetization
status: active
created: 2026-08-04
last_modified: 2026-08-13
---

# Monetization

frankchen.tw 的廣告變現：賣家授權宣告（ads.txt）、廣告版位的出現位置與出現條件、
廣告對頁面品質指標的不可逾越界線，以及隨之而來的 CSP 與隱私揭露義務。

## Requirements

### R1: 賣家授權宣告
- **Level**: MUST
- **Description**: 站台根目錄供應 `/ads.txt`，內容含 `google.com, pub-5544842849576289, DIRECT, f08c47fec0942fa0`。同時保留 `/app-ads.txt`（行動 App 用，內容相同）——兩者是不同規格、不同檢索路徑、不同對象，缺一不可互相取代。

### R2: 廣告只出現在文章頁
- **Level**: MUST
- **Description**: 廣告僅出現於 `/[...slug]/` 文章頁。首頁、`/articles/`、`/about/`、`/contact-frank/`、`/privacy-policy/`、分類頁、標籤頁一律不出現廣告。

### R3: 桌機兩側固定版位
- **Level**: MUST
- **Description**: 視窗寬度 ≥1600px 時，內容區左右留白各出現一個 160×600 固定版位，垂直起點在站台 header 之下。低於此寬度時該版位不可見，且不得對它送出廣告請求——在不可見的容器上初始化廣告會產生 console error，而 console error 是 Lighthouse Best Practices 的稽核項。可見性判斷與送出請求的判斷必須以同一個門檻值為準。

### R4: 兩側版位可由讀者收合
- **Level**: MUST
- **Description**: 兩側固定版位各提供收合控制，每側的收合狀態彼此獨立、各自在同一瀏覽階段內保存——收一側不得影響另一側的顯示或送請求與否。該控制必須具備可及名稱與展開狀態的無障礙標示，且兩顆按鈕的可及名稱必須能互相區分（帶側別）。

### R5: 文末版位
- **Level**: MUST
- **Description**: 文章內文結束、標籤區之前出現一個版位。此版位在行動版（≤1024px）是唯一版位。

### R6: 廣告不造成版面位移
- **Level**: MUST
- **Description**: 所有版位對 CLS 的貢獻為 0。廣告填充、收合或載入失敗都不得推擠任何既有內容。版位所需空間必須在 HTML 送出時即已確立，不得由前端腳本事後插入節點。

### R7: 廣告腳本延後載入
- **Level**: MUST
- **Description**: 廣告聯播網的腳本不隨 HTML 同步載入，於瀏覽器空閒時才注入。首屏渲染路徑上不得出現第三方廣告資源。

### R8: 廣告在所有環境一致輸出
- **Level**: MUST
- **Description**: 廣告版位與腳本在 CI、preview、正式站的輸出行為一致，不得以環境旗標讓 CI 量測不到廣告。CI 的 Lighthouse 分數必須反映讀者實際承擔的成本。

### R9: 品質門檻
- **Level**: MUST
- **Description**: 加上廣告後，CI 四個稽核頁面的 SEO 100、Accessibility ≥95、Performance ≥85 維持不變。Best Practices 門檻依實測結果調整（第三方 cookie 稽核必然失分），且只有掛廣告的頁面能降——首頁、文章列表、關於我沒有第三方 cookie 的來源，不得連帶失去原本的 100 防線。調整後的數值與實測依據記錄於 workflow 註解。
- **實測基準**（2026-08-04，Lighthouse 13.4.1 本機文章頁，兩次量測一致）：Best Practices 77，失分項 `third-party-cookies` 與 `inspector-issues` 的 Cookie issue，同根因是 doubleclick.net 的第三方 cookie——localhost 是 no-fill、廣告未填充也照種。門檻依此設為文章頁樣本 75、其餘三頁維持 100。CI 跑的是 `astro preview`，不套用 `public/_headers`，因此 CSP 放寬的代價不在此量測範圍內（見 R10）。

### R10: CSP 放行以實測為準
- **Level**: MUST
- **Description**: CSP 的廣告相關放行集合，以 `Content-Security-Policy-Report-Only` 在正式站收集到的真實違規為準，不照抄聯播網文件的建議清單。最終放行了什麼、為什麼、代價是什麼，記錄於 `public/_headers` 註解。
- **首輪實測**（2026-08-04，正式站文章頁 console，分兩次）：
  - 補進一個文件清單沒有的來源——`fundingchoicesmessages.google.com`（Google Privacy & Messaging，AdSense 載入後自行拉取），放行於 `script-src`／`connect-src`／`frame-src` 三處。它當時是被 enforcing 擋掉的（訊息結尾 `The action has been blocked`），除了功能受影響，被擋的資源會產生 console error 而扣 Best Practices
  - **判準修正**：第一次只補 `script-src`，理由是「`connect-src` 還沒出現違規，依本條以實測為準就不先加」——那是誤用。腳本一載入成功，它的三個子模組（`ad_blocking_detection`、`web_iab_tcf_v2_signal`、`cookie_refresh`）立刻對 `/el/` 端點回報，全被 `connect-src` 擋下並不斷重試，一次瀏覽刷出十幾則 console error。**本條的「以實測為準」管的是網域清單本身（哪些網域要放行），不是同一個已證實需要的網域每個 directive 都要各等一次實測**。一個第三方要載腳本就幾乎必然要發請求，會顯示 UI 的就必然要 iframe
  - Report-Only 的兩則 inline 違規，來源**全部**是 Cloudflare JS Detections 的 per-request 腳本（同頁連抓兩次皆 921 bytes 但 sha256 不同，坐實無法用 hash 放行）；**AdSense 一則內聯違規都沒有**
  - 因此「`'unsafe-inline'` 收不回來」目前成立，但卡點不是 AdSense 而是 JSD。關掉 JS Detections（API `PATCH /zones/<id>/bot_management` 帶 `{"enable_js": false}`）即可立刻收回這條讓步
  - 這是三次抽查的第一次，尚未結案

### R11: 隱私揭露
- **Level**: MUST
- **Description**: 隱私權政策移除「本站本身不使用追蹤型 Cookie」的陳述，新增第三方廣告與其 Cookie 的說明，並告知讀者如何退出個人化廣告。

### R12: 賣家授權宣告的迴歸防線
- **Level**: SHOULD
- **Description**: 建置驗證斷言 `dist/ads.txt` 存在且含正確的 publisher ID。

## Scenarios

### S1: AdSense 檢索賣家授權
- **Given**: 站台已部署
- **When**: 對 `https://frankchen.tw/ads.txt` 發出 GET
- **Then**: 回應 200，body 含 `pub-5544842849576289` 那一行；`/app-ads.txt` 同樣回 200
- **Implements**: #R1

### S2: 寬螢幕桌機讀者閱讀文章
- **Given**: 視窗寬度 1920px
- **When**: 開啟任一文章頁
- **Then**: 內容區左右留白各出現一個 160×600 版位，內文寬度與 aside 寬度不因廣告改變，捲動時版位固定不動
- **Implements**: #R3, #R6

### S3: 一般桌機讀者閱讀文章
- **Given**: 視窗寬度 1440px
- **When**: 開啟任一文章頁並檢視 DOM
- **Then**: 兩側版位不可見，且未對其送出廣告請求，console 無廣告相關錯誤
- **Implements**: #R3

### S4: 行動版讀者閱讀文章
- **Given**: 視窗寬度 375px
- **When**: 開啟任一文章頁
- **Then**: 只有文末一個版位可見，兩側版位不可見且未送出廣告請求
- **Implements**: #R3, #R5

### S5: 讀者收合側邊廣告
- **Given**: 寬螢幕桌機、兩側版位已顯示
- **When**: 點擊左側的收合控制，而後在同一階段內開啟另一篇文章
- **Then**: 左側維持收合、右側維持展開並照常送出廣告請求，且收合不造成任何內容位移
- **Implements**: #R4, #R6

### S6: 廣告未填充
- **Given**: 廣告請求回傳 no-fill（如非授權網域、聯播網無庫存）
- **When**: 頁面完成載入
- **Then**: 版面與有廣告時一致，無空白塌陷、無位移、無 console error
- **Implements**: #R6

### S7: 非文章頁不受影響（限冷啟動／文件層級）
- **Given**: 站台已部署廣告，讀者以開新分頁或直接輸入網址造訪（首次文件載入，不是從文章頁透過站內連結以 View Transitions 換頁過來的）
- **When**: 開啟首頁或 `/about/`
- **Then**: 該次文件載入不主動注入任何廣告聯播網資源
- **Note**: 此情境只涵蓋冷啟動。讀者若先看文章頁、再透過站內連結（View Transitions）導覽到首頁或 `/about/`，`adsbygoogle.js` 已在同一份 document 內執行過並常駐——Astro 換頁移除 `<head>` 裡的 `<script>` 元素不會卸載已經執行的程式碼，`window.__adsenseLoaded` 也仍為 `true`。這種同文件換頁的情境不在本 Scenario 涵蓋範圍內，也不違反 #R2：R2 管的是「哪些頁面主動掛廣告元件」，不是「同一份 document 曾經載入過的第三方腳本是否還留在記憶體裡」
- **Implements**: #R2

### S8: CI 稽核
- **Given**: 一個含廣告的 PR
- **When**: CI 對四個頁面跑 Lighthouse
- **Then**: SEO 100、Accessibility ≥95、Performance ≥85 全數通過；Best Practices 達到實測後訂定的門檻
- **Implements**: #R8, #R9

## Design Decisions

### D1: 手動 ad unit，不用 Auto ads
- **Decision**: 版位位置與數量由本站程式碼決定，不啟用 AdSense Auto ads
- **Rationale**: Auto ads 自行往內文任意位置插入，CLS 必然失控，且破壞 `design-system` spec 所守的 e-ink 排版節奏
- **Date**: 2026-08-04

### D2: 不做內文中段版位
- **Decision**: 不在第一個 h2 之後插入版位
- **Rationale**: 收益最高的位置，但需寫 rehype plugin 動到 markdown 渲染管線。取零管線風險，捨該版位收益
- **Date**: 2026-08-04

### D3: 不做 aside 內的 sticky 版位
- **Decision**: 側邊廣告走內容區外的固定定位，不放進 `.layout-aside`
- **Rationale**: aside 內的 sticky 位覆蓋 100% 桌機讀者，遠優於只服務 ≥1600px 螢幕的兩側位（估約一成流量），但需把 TOC 與廣告包進共用 sticky wrapper 並改 `TableOfContents.astro` 的 `max-height`。取零版面風險，收益差距已知並接受
- **Date**: 2026-08-04

### D4: 不用環境旗標隱藏 CI 的廣告
- **Decision**: 廣告在所有環境一致輸出
- **Rationale**: 環境旗標可以讓門檻一分不動，但 CI 綠燈就不再代表讀者實際體驗，等於用假訊號換數字
- **Date**: 2026-08-04

### D5: 接受 `script-src` 放寬
- **Decision**: 若實測證實 AdSense 非 `'unsafe-inline'` 不可，全站統一放寬並在 `_headers` 註解記錄
- **Rationale**: nonce 需 per-request 產生，本站 HTML 是靜態資產、只能在 middleware 逐請求改寫，等於毀掉邊緣快取，且 AdSense 動態注入的 script 不會帶我們的 nonce；`'strict-dynamic'` 同樣需要 nonce 或 hash 當信任根。逐路徑分設寬嚴在 `_headers` 內不可行——文章頁 `/<slug>/` 在其萬用字元下與 `/about/` 無法區分，且 Cloudflare 對同名標頭是合併不是覆蓋，兩份 CSP 並存時取交集，廣告一樣被擋。改由 `functions/_middleware.js`（已對每個頁面請求執行、已在做標頭層操作）逐路徑覆寫尚未評估，是未來可收斂的方向，不是已排除的選項
- **Date**: 2026-08-04

### D6: publisher ID 以常數存放，不用 env var
- **Decision**: `ca-pub-5544842849576289` 寫入 repo 常數
- **Rationale**: 該 ID 本來就要公開在 `/ads.txt`，不是機密；用 env var 只會多一層各環境不一致的來源，與 #R8 相衝
- **Date**: 2026-08-04

### D7: 第一版不裝 CMP
- **Decision**: 不導入同意管理平台
- **Rationale**: 已於 2026-08-04 查證：政策自 2024-01-16 生效至今未變，未使用認證 CMP 時 Google 會限制對 EEA/UK 使用者顯示的廣告（多半只投放非個人化廣告，或依設定不投放），而非將帳號判為違規。讀者以台灣為主，代價僅止於歐洲流量收益（非個人化廣告 eCPM 約低 50-70%）。CMP 會再引入一支第三方腳本與一輪 CSP、效能成本，有實際歐洲流量時再評估。此政策每年在變，日後重評時要重查
- **Date**: 2026-08-04

### D8: idle 載入而非 IntersectionObserver
- **Decision**: 廣告腳本在瀏覽器空閒時注入，不等版位進入視窗
- **Rationale**: 兩側位是固定定位、一載入就在視窗內，IntersectionObserver 等於沒延後；文末位在行動版位置很深，而 Lighthouse 量測不捲動頁面，用 IntersectionObserver 會讓腳本在 CI 裡永遠不載入——分數好看但違反 #R8
- **Date**: 2026-08-04

### D9: 收合狀態逐側各存一把 key
- **Decision**: `sessionStorage` 以 `ads-side-collapsed-left` / `ads-side-collapsed-right` 兩把 key 保存，不共用單一鍵；原本的共用鍵直接棄用，不寫搬遷
- **Rationale**: 共用單一鍵時兩顆按鈕寫的是同一份狀態，收一邊兩邊都收——行為自洽，但 UI 給了兩個控制項卻只有一份狀態，按鈕在說謊。另一條路是收斂成單一控制項，但兩側版位各自 `position: fixed`、沒有共同容器，那顆按鈕沒有自然落點，且與 #R4「各提供收合控制」相衝。棄用舊鍵不做搬遷：狀態存在 `sessionStorage`，最久只影響當前分頁這一輪瀏覽，搬遷程式碼會比它救到的東西活得更久
- **Date**: 2026-08-13

## 待正式站驗證的項目

以下五項在合併前做不完——AdSense 只在通過審核的正式網域投放，本機與 Pages preview 一律是 no-fill。
驗收條件與判讀方式寫在 `docs/plans/2026-08-04-adsense-placement.md` 的「上線後才做得完的收尾」。

1. CSP 最小放行集（R10）：**第一次抽查已完成**（2026-08-04，見 R10 的首輪實測），補進 `fundingchoicesmessages.google.com`、確認 `'unsafe-inline'` 的卡點是 JSD 而非 AdSense。還差兩次抽查（間隔至少 1 週、涵蓋 2 種素材類型）才能結案
2. Best Practices 收緊（R9）：第一輪 CI 跑完後，文章頁若穩定高於 75 就該把門檻收回來
3. 文末版位實際高度（R6）：`min-height: 280px` 是估計值，只保證地板不保證天花板
4. COOP 對廣告點擊的影響：`Cross-Origin-Opener-Policy: same-origin` 會切斷新開分頁與本站 window 的連結，而廣告點擊一律開新分頁，這個組合沒有人評估過
5. EEA/UK 的 CMP 政策（D7）：已於 2026-08-04 查證一次，此政策每年在變，日後有歐洲流量時要重查
