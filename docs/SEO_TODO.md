# SEO 待辦事項

SEO Perfection Engine 施工後仍未完成的事項。分三類：A 需要站主提供資料才能完成、
B 是內容工作（非技術修復，需要站主判斷）、C 是已評估後決定不做／接受現況。

完整的施工決策與理由見 `docs/specs/seo-perfection.md`；操作層面的指南見
`docs/SEO_GUIDE.md`。

## A. 需要站主提供資料才能完成

本節四項已於 2026-07-23 全數結案，保留紀錄供日後追溯。

- [x] **Google Search Console 驗證碼**（已完成）。網域主要以 DNS TXT 驗證，另在
      `SITE.googleSiteVerification` 直接寫入驗證碼作為第二道錨點——DNS 若搬移或
      改寫，驗證不會跟著斷。值直接進版控而非走環境變數：它本來就會原樣出現在每
      一頁的 HTML 裡，不是秘密，藏進環境變數只多一道部署設定卻沒換到任何保護。
      仍保留 `PUBLIC_GOOGLE_SITE_VERIFICATION` 覆寫，方便 fork 或預覽環境替換。
- [x] **GSC 提交 sitemap 與監控配置**（已完成）。站主已提交
      `https://frankchen.tw/sitemap.xml`。後續觀察索引涵蓋率與效能報表屬日常維運，
      不再列為待辦。
- [x] **X / Twitter handle**（已完成）。`SITE.twitterHandle` 設為 `@frankchen_tw`，
      `twitter:site` / `twitter:creator` 已輸出；同時把 `https://x.com/frankchen_tw`
      加進 `SITE.sameAs`，讓搜尋引擎把該帳號歸到同一個實體。注意該筆刻意排在
      `sameAs` 第五位——`SOCIAL` 圖示列是以固定索引 0–3 取值，新增不影響版面。
- [x] **squirrelscan 雲端帳號**（已評估，不做）。站主決定不開帳號。影響：拿不到
      雲端的排行榜式總分，因此清單原訂的「squirrelscan ≥ 95/100」改以本地稽核的
      四項分數（SEO/Performance/Security/Agents）在正式站的實測值當驗收基準。
      `seo-daily.yml` 本來就以 `--offline` 執行，不受影響。

## B. 內容工作（非技術修復，需要站主判斷）

- [x] **3 條外部死連結**（已於 2026-07-23 全數處理）：
  - `charlsondou.com/get-instagram-api-token-auto-update/`（連線失敗，整個網域
    無回應而非單頁 404），出現在 `/n8n-instagram-access-token` 的參考資料。
    已換成 Meta 官方文件「Instagram 商家登入」——該頁有「步驟 3：取得長期存取
    權杖」與「重新整理長期權杖」，正好對應原連結的主題。以真實瀏覽器開啟求證
    過（curl 會被 Meta 的機器人偵測擋成 400，不能據此判斷死活）；並直接使用
    `/documentation/` 這個最終網址，避免多一次 `/docs/` 的轉址。
  - `github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md`
    （404），出現在 gemini-cli 那篇。上游重整了 `docs/` 目錄結構，該檔已不存在。
    因為原文那段是在講 `/mcp` 指令，改指 `docs/tools/mcp-server.md`（實測 200），
    而非範圍較廣的 `docs/reference/configuration.md`。
  - `your.wordpress.url/wp-json/wp/v2/media)，WordPress...`，出現在
    `/n8n-notion-wordpress-publish-automation`。不是真的外部連結，是刻意的**佔位
    範例網址**被 markdown 自動連結時把後面的 `)` 與中文一起吞進 URL。已改成行內
    程式碼，既不會被轉成連結，也讓讀者更清楚那是要替換的佔位符。同時補回該句
    原本掉失的內連（WordPress 搬家時遺失，句子停在「請見 。」），指向
    `/n8n-wordpress-api-integration-guide/`。
  - LinkedIn（`https://www.linkedin.com/in/frankchen0130/`）回 999 是該站對爬蟲的
    反制行為，不是實際死連結，已評估標記為忽略，不需處理。
- [x] **內容過薄頁面**（squirrelscan word-count 警告，15 頁）。已評估，接受現況。
      該規則以空白切詞計算，對中文有系統性低估——例如
      `/raspberry-pi-gpio-high-frequency-noise/` 實際有 1535 個漢字、是篇完整的
      踩坑紀錄，卻只被算成 219 個 word。15 頁逐一量測後的歸類：
  - **規則對中文失準、內容其實不薄（8 頁）**：`/`、`/about/`、`/privacy-policy/`、
    `/threads-data-export-tutorial/`、`/n8n-template-store-wish-list/`、
    `/samsung-wallet-nfc-access-card-.../`、`/raspberry-pi-gpio-high-frequency-noise/`、
    `/n8n-data-table-csv-export-import/`（漢字數 358–1535）。
  - **版面本來就該短（6 頁）**：5 個分類頁與 `/contact-frank/`。分類頁的功能是
    導覽（一列文章連結），聯絡頁就是 email 與社群連結；硬塞字會傷可用性，
    換來的只有一條審計規則的分數。
  - 剩下 1 篇（gemini-cli）另列於下方，原因不是字數。

- [ ] **`/google-new-opensource-too-gemini-cli-...` 內容已過時，待站主更新**。
      這篇不是字數問題（雖然它確實是 15 頁裡唯一偏薄的，468 漢字）。真正的問題是
      **前提已不成立**：Gemini CLI 的免費額度政策改了，一般訂閱戶已不再適用，而
      文章標題仍寫「提供大量免費額度」、description 仍寫「每分鐘 60 次，每天
      1000 次」。過時的事實陳述對 E-E-A-T 的傷害遠大於篇幅不足，且標題與現況不符
      會直接影響點擊後的跳出率。站主已表示後續會維護。
      過渡期的低成本作法（若更新會拖較久）：在文章開頭加一段標註日期的更新說明，
      並同步修正 title 與 description 的額度數字；`updated` 欄位一併更新，
      sitemap 的 lastmod 會自動跟著改（見 `astro.config.mjs` 的 `POST_LASTMOD`）。
- [ ] **Keyword stuffing 警告**（squirrelscan 標記 25 頁有詞彙過度重複的疑慮）。
      需要站主逐篇檢視是否為技術文件常見的必要重複用詞（例如同一個 API 名稱、
      工具名稱反覆出現），或是真的需要改寫，非技術面可自動判斷的問題。
- [x] **4 篇 meta description 複檢**（已於 2026-07-23 逐篇對照原文查證完畢）：
  - `n8n-credentials-setup-complete-guide`：**正確**。正文有「### 7. Google 系列 -
    最複雜但最常用」章節。描述列了 6 個服務、正文實際有 8 個（另含 Canva 與
    Instagram/Facebook），屬選擇性列舉而非錯誤。
  - `nginx-cache-wordpress`：**正確**。正文有「## 如何驗證快取是否生效？」下的
    「### 查看 X-Cache-Status Header」與「### 分析快取命中率」兩節，描述所述操作
    確實存在。
  - `raspberry-pi-gpio-high-frequency-noise`：**正確**。正文原句為「以高頻電刀為例，
    會產生 350 kHz 左右的頻率」，而高頻電刀正是該文所指的干擾源，因此把它稱為
    干擾源頻率不是誤寫。
  - `flutter-study-materialapp-vs-cupertinoapp`：**已修正**。原描述結尾的 `…` 是
    自動摘要的截斷殘留，語意不完整。改寫為完整句並對齊正文實際結構（定義、
    核心作用、常用屬性、比較表格），長度 145 字元。

## C. 已評估後決定不做／接受現況

- [x] **封鎖 CCBot 等訓練型爬蟲**。已評估，不做（維持封鎖）。這是站主刻意的訓練
      資料退出決定，已知會連帶影響 Common Crawl 語料收錄與依賴它的 Wayback
      Machine 覆蓋率，接受此代價。詳見 `public/robots.txt` 與
      `docs/SEO_GUIDE.md`。
- [x] **裝飾性圖片 `alt=""` 被 squirrelscan 判為缺 alt**。已評估，不做。
      `alt=""` 才是裝飾性圖片的正確寫法（螢幕閱讀器會跳過，不會念出檔名或
      「圖片」），本站這幾張圖的資訊已由同卡片的標題與描述文字承載。
      Lighthouse Accessibility 分數以此為準（現況 100 分），不依 squirrelscan
      這條規則調整。
- [x] **中文標籤網址含非 ASCII 字元**（squirrelscan 的 URL Lowercase / Special
      Characters 警告，例如 `/tag/%E6%A8%A1%E6%9D%BF/`）。已評估，不做。這是
      刻意保留可讀中文標籤（如「模板」）的結果——把標籤網址改成拼音或英文會
      犧牲可讀性與使用者辨識度，換來的只是一條審計規則的分數，不值得。
- [x] **SearchAction / SoftwareApplication / FAQPage / HowTo / web-vitals RUM**。
      已評估，不做。理由見 `docs/SEO_GUIDE.md`「刻意不做的事」一節，各有一句
      對應理由（無站內搜尋、無專屬產品頁、Google 已限縮資格、與隱私權承諾衝突）。
- [x] **Markdown Response**（`Accept: text/markdown` 內容協商，讓 AI 爬蟲直接
      拿到 markdown 而非 HTML）。已評估，不做。Cloudflare Pages 是純靜態託管，
      無法依 `Accept` header 做內容協商；要做得改用 Cloudflare Pages Functions
      額外起一層伺服器邏輯，對一個靜態部落格而言成本高於效益。
