---
domain: preferred-sources
status: draft
created: 2026-08-21
last_modified: 2026-08-21
---

# Preferred Sources

讓讀者把 frankchen.tw 設為 Google 偏好來源的站內入口：deep link 的組成與單一來源、
兩個放置點的出現條件，以及點擊成效的量測方式。

## Requirements

### R1: deep link 的網域取自站台 SSOT
- **Level**: MUST
- **Description**: 指向 `https://www.google.com/preferences/source` 的連結，其 `q` 參數與
  `utm_source` 一律取自站台正規網址的 hostname，不得出現第二份網域字面值。改站台網域時只需
  改一處，所有出口跟著變。

### R2: 可重用元件，放置點決定形態
- **Level**: MUST
- **Description**: 站內所有偏好來源入口由同一個元件輸出，以「放置點」為唯一參數。放置點同時
  決定外觀形態、UTM 的版位標記、以及 Google 標誌用四色還是單色。不得出現形態與版位標記各自
  設定而可能對不上的介面。

### R3: 兩個放置點與出現範圍
- **Level**: MUST
- **Description**: 文章頁側邊欄作者區塊之前出現完整按鈕形態；全站 footer 的社群圖示列尾端
  出現圖示形態。footer 那顆必須出現在每一頁（含文章頁）——側邊欄在 1024px 以下不渲染，若
  footer 版排除文章頁，手機與平板的文章讀者在站上將沒有任何入口。

### R4: 外連屬性
- **Level**: MUST
- **Description**: 連結以新分頁開啟並帶 `rel="noopener noreferrer"`，與站上其他外連一致
  （見 `docs/specs/site-pages.md` R19）。

### R5: 沿用既有 design token，不引入新色
- **Level**: MUST
- **Description**: 站台自身的所有色值取自 `global.css` 既有的 design token，不新增色票。品牌
  色半透明宣告與濃度一律遵守 `docs/specs/design-system.md` R1／R2。唯一
  例外是 Google 標誌的四個品牌色——那是外部商標的固定色，寫在標誌本身、不進 design token。
  footer 那顆的尺寸與間距跟隨同列社群圖示，hover 因無 `currentColor` 可換而改以透明度變化
  對齊「hover 變亮」的語意。

### R6: 高對比模式下標誌不失真
- **Level**: SHOULD
- **Description**: `forced-colors` 生效時，四色 Google 標誌保留原色而非被系統色塗平，其餘
  元素跟隨系統高對比配色。

### R7: 點擊成效可依版位區分
- **Level**: MUST
- **Description**: 每個放置點的連結帶各自的 UTM 版位標記，使站台自有的分析工具能分辨點擊來自
  哪一個放置點。不為此新增任何 client 端腳本、不變更 CSP、不新增站內轉址路徑。

### R8: 不擴張既有稽核與宣告面
- **Level**: MUST
- **Description**: 此功能不修改 `robots.txt`、`llms.txt`、任何 JSON-LD，也不修改 `verify-*`
  腳本的檢查範圍或白名單。偏好來源是讀者端行為，不需要結構化資料支援。

### R9: 標誌原樣使用，不得變造
- **Level**: MUST
- **Description**: 兩個放置點皆使用四色 Google 標誌，且一律原樣呈現——不改色、不改比例、不加
  外框或陰影、不與本站標誌組合成共同品牌。標誌僅可整體縮放。實作不得憑記憶重繪標誌路徑。

## Scenarios

### S1: 桌機讀者讀完文章
- **Given**: 視窗寬度大於 1024px 的文章頁
- **When**: 讀者看向側邊欄
- **Then**: 作者區塊上方出現一顆完整按鈕，點擊後於新分頁開啟 Google 的來源偏好設定頁並帶出
  本站網域
- **Implements**: #R1, #R2, #R3, #R4

### S2: 手機讀者讀完文章
- **Given**: 視窗寬度不大於 1024px 的文章頁（側邊欄不渲染）
- **When**: 讀者捲到頁面底部
- **Then**: footer 社群圖示列尾端仍有一個可點的偏好來源入口
- **Implements**: #R3

### S3: 兩個放置點各自產生點擊
- **Given**: 側邊欄與 footer 兩顆都已上線，且站台分析工具的外連點擊追蹤為啟用狀態
- **When**: 讀者分別從兩處點擊
- **Then**: 分析報表中兩筆點擊帶有不同的版位標記，可分別統計
- **Implements**: #R2, #R7

### S4: 高對比模式
- **Given**: 使用者開啟 Windows 高對比模式
- **When**: 瀏覽含偏好來源按鈕的頁面
- **Then**: 按鈕邊框與文字跟隨系統配色且可辨讀，四色 Google 標誌維持原色
- **Implements**: #R6

### S5: footer 圖示列的 hover
- **Given**: footer 社群圖示列，五顆單色圖示加尾端一顆四色 Google 標誌
- **When**: 滑鼠移入該標誌
- **Then**: 標誌整體變亮，四個品牌色維持原樣不被替換，尺寸與位置不變
- **Implements**: #R5, #R9

## Design Decisions

### D1: 以放置點命名 prop，而非以外觀命名
- **Decision**: 元件唯一的 prop 是放置點（`aside` / `footer`），不是外觀形態
- **Rationale**: 放置點同時決定形態、UTM 版位標記與標誌配色三件事。若拆成外觀 prop 加版位
  prop，就可能出現形態對了但版位標錯的組合，而這種漂移不會有任何東西擋得下來
- **Date**: 2026-08-21

### D2: footer 版全站出現，接受桌機文章頁同時有兩顆
- **Decision**: footer 那顆不排除文章頁
- **Rationale**: 側邊欄在 1024px 以下整個不渲染，排除文章頁等於讓手機讀者完全沒有入口，而
  手機通常是部落格流量大宗。兩顆形態差異大、位置相距遠，不會讀成重複
- **Date**: 2026-08-21

### D3: 量測靠 UTM 加分析工具內建的外連點擊追蹤
- **Decision**: 不寫任何 client 端腳本，不建站內轉址路徑，只在連結上掛 UTM
- **Rationale**: 站上已有 GA4，其增強型評估的外連點擊事件會記下完整 `link_url`，UTM 參數
  因此可回收。自訂事件要多一支腳本與一個 click listener；`/go/` 中介轉址則會撞上
  `verify-seo` 的站內連結解析檢查。兩者在 GA4 已存在的前提下都是多餘成本
- **Date**: 2026-08-21

### D4: 側邊欄那顆不加小標與說明句
- **Decision**: 側邊欄只放一顆按鈕，不套用 `.aside-widget-title` 的小標語彙、不加說明文字
- **Rationale**: 小標的作用是替一段內容命名（「作者」「相關文章」），一顆自帶文字的按鈕不需要
  再被命名一次，且小標文字會與按鈕文字語意重複。附帶省掉在元件內複製小標 CSS 的維護成本
  （Astro scoped style 無法跨檔共用）
- **Date**: 2026-08-21

### D5: 不動 SocialIcons
- **Decision**: footer 的圖示不塞進 `SocialIcons.astro` 的清單，改在 `Footer.astro` 以同一列
  容器並排
- **Rationale**: 該元件由 `SOCIAL` 陣列驅動，而 `SOCIAL` 推導自 `SITE.sameAs`（社群帳號的
  單一來源）。塞一個不是社群帳號的項目會讓那份資料同時代表兩種東西
- **Date**: 2026-08-21

### D6: 沿用 repo 的 `noopener noreferrer`，不用需求指定的 `noopener`
- **Decision**: 外連屬性跟隨站上既有慣例
- **Rationale**: 差別只在 Google 那端看不看得到 Referer，而成效由本站分析工具記錄、不靠對方
  回報，拿掉 referrer 沒有損失；反之，站上出現唯一一個寫法不同的外連會是後續維護的雜訊
- **Date**: 2026-08-21

### D7: 接受此功能沒有自動化回歸防線
- **Decision**: 不為此新增 `verify-*` 檢查，也不新增單元測試
- **Rationale**: 需求明確要求不碰 `verify-*`；而網址組裝依 SSOT 規定必須放 `site-meta.ts`，
  該路徑不在 `npm test` 的涵蓋範圍（只跑 `scripts/lib/`）。結果是改壞 UTM 或網域時 CI 仍會
  全綠。這是刻意的取捨，記錄在此以免日後誤以為有防線
- **Date**: 2026-08-21

### D8: 採用四色 Google 標誌，商標風險已知並接受
- **Decision**: 兩個放置點都用四色 Google 標誌，標誌 SVG 由站方提供，不使用官方素材包
- **Rationale**: 官方素材包（2026-08-21 下載確認）只有 17 個語系的 PNG，沒有中文、沒有 SVG，
  英文暗色版是 676×213 的黑色 pill，既無法用於中文站也無法融入站台風格；官方 standard
  JavaScript button 雖能自動翻譯成中文，但需載入 Google script 並放寬 CSP，而 CSP 寫死在
  `verify-headers.mjs`，動它違反「不碰 `verify-*`」的需求。Google 品牌規範載明不得將 G 用於
  商業行銷素材，此 CTA 是否落入該範圍有解釋空間但方向偏向「是」。風險已完整說明，站方決定
  採用並自行承擔
- **Date**: 2026-08-21

## Open Questions

<!-- 使用者明說先不決定的項目。AI 不得自行判定某項可延後。finish spec sync 不清除此區 -->

（無）

## Pending Changes

<!-- Brownfield delta 放這裡，finish spec sync 時清除 -->
