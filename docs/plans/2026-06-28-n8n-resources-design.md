# n8n-resources 完整策展頁 — 設計文件

- 日期：2026-06-28
- 分支：feat/n8n-resources
- Spec domain：site-pages（brownfield，MODIFIED R17 + ADDED R18/R19）
- 原站參考：https://www.frankchen.tw/n8n-resources/

## 背景與目標

`/n8n-resources/` 目前是占位頁（spec R17）。本案將其升級為比照原 WordPress 站的完整 7 區塊策展頁。前兩區是本站 collection 既有內容（n8n 文章、模板文章），後五區是外部策展連結（YouTube 創作者、進階應用、推薦模板、Line 社群、官方資源）。

設計原則（已與使用者確認）：
1. 教學文章區只精選最新 6 篇 n8n 文章＋連到既有 `/category/n8n/`，不在本頁重做分頁（避免與分類頁重複）
2. 視覺沿用站台 e-ink 深色系與既有版面骨架，不照搬 WordPress 配色
3. 外部策展內容原樣沿用原站（URL／描述文字已擷取為實際值）
4. 創作者／模板卡帶原站 150×150 縮圖，社群區帶 QR 圖

## 架構

### 頁面
`src/pages/n8n-resources.astro`（替換現有 stub）。build 時：
- 查 collection：`category === 'n8n' && !draft` 取最新 6 篇；`tags` 含「模板」且 `!draft` 取 3 篇（依日期降序）
- import `src/data/n8n-resources.ts` 取後五區策展資料
- 以 `.container` + 每區一個 `.section`（區塊間 border-top）+ `.section-header` 組版，與首頁一致

### 資料層
新檔 `src/data/n8n-resources.ts`，型別化單一來源：

```ts
type ResLink = { label: string; href: string };
type Creator = { name: string; desc: string; image: string; links: ResLink[] };
```

匯出：`LEARNING_RESOURCES`、`ADVANCED_APPS`、`RECOMMENDED_TEMPLATES`（皆 `Creator[]`）、`COMMUNITY`（單一物件）、`OFFICIAL_LINKS`（`ResLink[]`）。

### 元件
- 區塊 1、2：復用既有 `ArticleCard.astro`，放 `.article-grid`（global.css 既有三欄 grid），cover 用 collection 內既有圖
- 新增 `ResourceCard.astro`：方形縮圖（~72px）＋ name ＋ desc ＋一排 labeled links；樣式比照首頁 `project-card`（深色卡、`einkRefresh` hover、橘色底線連結）。供區塊 3/4/5 共用
- 區塊 6（社群 CTA）、7（官方連結排）夠簡單，直接 inline 於頁面，不另開元件

## 外部策展資料明細（execute 直接採用）

### 區塊 3：推薦學習資源（LEARNING_RESOURCES）
| name | desc | image | links |
|---|---|---|---|
| HC AI說人話 | n8n AI 實作 0 基礎入門到進階（3 小時影片） | hc-ai.webp | YouTube 頻道 https://www.youtube.com/@HC-AIChannel｜影片 https://www.youtube.com/watch?v=vvqhzbp4J5A｜Threads https://www.threads.com/@hc_aichannel |
| 偷懶辦公室（LazyOffice） | 《提早下班系列》N8N + OpenAI 整合 LINE、Gmail、行事曆 | lazyoffice.webp | YouTube 頻道 https://www.youtube.com/@LazyOffice2024｜影片 https://www.youtube.com/watch?v=RxXMQ8CG5RI｜Threads https://www.threads.com/@lazyoffice2024 |
| PAPAYA 電腦教室 | n8n 工作流基礎教學（3 集系列） | papaya.webp | YouTube 頻道 https://www.youtube.com/@papayaclass｜播放清單 https://www.youtube.com/playlist?list=PL7enJ2-v6SPk1_XBg2cOp58uV25_pamFd |

### 區塊 4：推薦進階應用（ADVANCED_APPS）
| name | desc | image | links |
|---|---|---|---|
| Darrell | n8n 教學：節點介紹、模板、部署指南 | darrell.webp | Threads https://www.threads.com/@darrell_tw_｜Website https://www.darrelltw.com/｜教學資源 https://www.darrelltw.com/n8n-tutorial-resources/ |
| 科技宅阿高 | n8n 自動化流程教學 | geekaz.webp | Threads https://www.threads.com/@geekaz/｜Website https://geekaz.net/｜文章標籤 https://geekaz.net/tag/automation-workflow/ |

### 區塊 5：推薦模板（RECOMMENDED_TEMPLATES）
| name | desc | image | links |
|---|---|---|---|
| Darrell | 信用卡帳單自動建日曆提醒 | tpl-creditcard.webp | 模板 https://www.darrelltw.com/tools/n8n_template/model/creditcard.html |
| Vicky（鋼鐵Ｖ） | n8n 面試大師 | tpl-interviewer.webp | 模板 https://portaly.cc/ironvicky/product/myRHqQsuZLAz2TVrvDe4｜Threads https://www.threads.com/@ironv.careerlife |
| Darks | AI 知識助手 | tpl-ai-assistant.webp | 模板 https://portaly.cc/darks/product/XVvmqhkHO2BeiGn81IHc｜Website https://lifecheatslab.com/ |

### 區塊 6：推薦 Line 社群（COMMUNITY）
- name：n8n & AI & Vibe Coding 討論交流群
- desc：社群裡充滿各路大神，歡迎有任何有關 n8n、AI、Vibe Coding 問題的大家加入群組一起討論
- QR image：line-community-qr.jpg
- 加入連結：https://line.me/ti/g2/bfnrSbbUE56PISKtQa9KK5gqpMhed_DXf-hmQw

### 區塊 7：官方資源（OFFICIAL_LINKS）
| label | href |
|---|---|
| 官方網站 | https://n8n.io/ |
| 官方文件 | https://docs.n8n.io/ |
| 官方模板 | https://n8n.io/workflows/ |
| 官方 Github | https://github.com/n8n-io/n8n |

## 七區塊呈現

1. 教學文章 — 標題＋`查看全部 n8n 文章 →`（→ `/category/n8n/`）；最新 6 篇 n8n `ArticleCard`，`.card-grid--three`
2. 模板分享 — 標題＋`更多模板 →`（→ `/tag/模板/`）；3 篇模板 `ArticleCard`
3. 推薦學習資源 — 3 張 `ResourceCard`
4. 推薦進階應用 — 2 張 `ResourceCard`
5. 推薦模板 — 3 張 `ResourceCard`
6. 推薦 Line 社群 — CTA 卡：QR 圖＋說明＋「加入 LINE 社群」按鈕
7. 官方資源 — 4 個外部連結按鈕排

頁頂沿用 list 頁標題區（h1「n8n 相關資源」＋一段簡介），`BaseLayout` title 用 `pageTitle('n8n 相關資源')`。

## 連結 / 錯誤 / SEO

- 外部連結一律 `target="_blank" rel="noopener noreferrer"`；站內文章連結維持同分頁
- 站內區塊用 `length > 0` 守門，無文章時不渲染空標題（現況 n8n 16 篇、模板 3 篇）
- SEO：沿用 `BaseLayout` 既有 head；本案不新增 JSON-LD（YAGNI，日後另議）

## 資產下載清單（execute 階段，使用者已授權下載）

下載到 `public/n8n-resources/`（沿用 D2「public/ 放靜態圖」慣例）：

| 來源 URL | 存檔 |
|---|---|
| https://www.frankchen.tw/wp-content/uploads/2025/10/n8n-learn-hc-ai-150x150.webp | hc-ai.webp |
| https://www.frankchen.tw/wp-content/uploads/2025/10/n8n-learn-lazyoffice-150x150.webp | lazyoffice.webp |
| https://www.frankchen.tw/wp-content/uploads/2025/10/n8n-learn-papaya-150x150.webp | papaya.webp |
| https://www.frankchen.tw/wp-content/uploads/2025/10/n8n-learn-darrell-150x150.webp | darrell.webp |
| https://www.frankchen.tw/wp-content/uploads/2025/10/n8n-learn-geekaz-150x150.webp | geekaz.webp |
| https://www.frankchen.tw/wp-content/uploads/2025/10/n8n-template-cover-creditcard-150x150.webp | tpl-creditcard.webp |
| https://www.frankchen.tw/wp-content/uploads/2025/10/n8n-template-cover-interviewer-150x150.webp | tpl-interviewer.webp |
| https://www.frankchen.tw/wp-content/uploads/2025/10/n8n-template-cover-ai-assistant-150x150.webp | tpl-ai-assistant.webp |
| https://www.frankchen.tw/wp-content/uploads/2025/10/line-group-n8n-ai-vibecoding-150x150.jpg | line-community-qr.jpg |

`src/data/n8n-resources.ts` 的 `image` 欄位以 `/n8n-resources/<檔名>` 引用。

## 測試

repo 無 test/lint。驗證＝`npm run build` 通過（頁數不變，路由已存在）＋ 手動：7 區塊齊全、最新 6 篇 n8n 卡與模板 3 卡正確、縮圖／QR 顯示、外部連結開新分頁且指向正確 URL、`查看全部`／`更多模板` 連結正確。

## Spec delta

寫入 `site-pages.md` 的 `## Pending Changes`：
- MODIFIED R17：占位頁 → 完整 7 區塊策展頁
- ADDED R18：外部策展資料以 `src/data/n8n-resources.ts` 型別化單一來源
- ADDED R19：頁面外部連結一律新分頁＋`rel="noopener noreferrer"`
