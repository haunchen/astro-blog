---
domain: monetization
status: draft
created: 2026-08-04
last_modified: 2026-08-04
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
- **Description**: 視窗寬度 ≥1600px 時，內容區左右留白各出現一個 160×600 固定版位，垂直起點在站台 header 之下。低於此寬度時該版位的 DOM 完全不輸出——不得以隱藏方式保留節點，隱藏容器上的廣告初始化會產生 console error，而 console error 是 Lighthouse Best Practices 的稽核項。

### R4: 兩側版位可由讀者收合
- **Level**: MUST
- **Description**: 兩側固定版位各提供收合控制，收合狀態在同一瀏覽階段內保存。該控制必須具備可及名稱與展開狀態的無障礙標示。

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
- **Description**: 加上廣告後，CI 四個稽核頁面的 SEO 100、Accessibility ≥95、Performance ≥85 維持不變。Best Practices 門檻依實測結果調整（第三方 cookie 稽核必然失分），調整後的數值與實測依據記錄於 workflow 註解。

### R10: CSP 放行以實測為準
- **Level**: MUST
- **Description**: CSP 的廣告相關放行集合，以 `Content-Security-Policy-Report-Only` 在正式站收集到的真實違規為準，不照抄聯播網文件的建議清單。最終放行了什麼、為什麼、代價是什麼，記錄於 `public/_headers` 註解。

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
- **Then**: 兩側版位的節點不存在，console 無廣告相關錯誤
- **Implements**: #R3

### S4: 行動版讀者閱讀文章
- **Given**: 視窗寬度 375px
- **When**: 開啟任一文章頁
- **Then**: 只有文末一個版位，兩側版位節點不存在
- **Implements**: #R3, #R5

### S5: 讀者收合側邊廣告
- **Given**: 寬螢幕桌機、兩側版位已顯示
- **When**: 點擊收合控制，而後在同一階段內開啟另一篇文章
- **Then**: 版位維持收合狀態，且收合不造成任何內容位移
- **Implements**: #R4, #R6

### S6: 廣告未填充
- **Given**: 廣告請求回傳 no-fill（如非授權網域、聯播網無庫存）
- **When**: 頁面完成載入
- **Then**: 版面與有廣告時一致，無空白塌陷、無位移、無 console error
- **Implements**: #R6

### S7: 非文章頁不受影響
- **Given**: 站台已部署廣告
- **When**: 開啟首頁或 `/about/`
- **Then**: 頁面不載入任何廣告聯播網資源
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
- **Rationale**: nonce 需 per-request 產生，本站 HTML 是靜態資產、只能在 middleware 逐請求改寫，等於毀掉邊緣快取，且 AdSense 動態注入的 script 不會帶我們的 nonce；`'strict-dynamic'` 同樣需要 nonce 或 hash 當信任根。逐路徑分設寬嚴也不可行——文章頁 `/<slug>/` 在 `_headers` 萬用字元下與 `/about/` 無法區分，且 Cloudflare 對同名標頭是合併不是覆蓋，兩份 CSP 並存時取交集，廣告一樣被擋
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

## Pending Changes

<!-- Brownfield delta 放這裡，finish spec sync 時清除 -->
