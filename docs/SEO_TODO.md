# SEO 待辦事項

SEO Perfection Engine 施工後仍未完成的事項。分三類：A 需要站主提供資料才能完成、
B 是內容工作（非技術修復，需要站主判斷）、C 是已評估後決定不做／接受現況。

完整的施工決策與理由見 `docs/specs/seo-perfection.md`；操作層面的指南見
`docs/SEO_GUIDE.md`。

## A. 需要站主提供資料才能完成

- [ ] **Google Search Console 驗證碼**。現況：程式端已備妥，走
      `PUBLIC_GOOGLE_SITE_VERIFICATION` 環境變數（`src/utils/site-meta.ts` 的
      `SITE.googleSiteVerification`），未設定時 `BaseLayout.astro` 不會輸出
      `<meta name="google-site-verification">`。需要站主到 GSC 註冊網域資源後，
      取得驗證用的 `content` 字串，設到 Cloudflare Pages 專案的環境變數
      `PUBLIC_GOOGLE_SITE_VERIFICATION`，重新部署即可生效。
- [ ] **GSC 提交 sitemap 與監控配置**。需要站主登入 GSC 帳號操作（新增資源、提交
      `https://frankchen.tw/sitemap.xml`、後續觀察索引涵蓋率與效能報表）。程式端
      已備妥 `/sitemap.xml`（單一檔案，見 `astro.config.mjs` 的
      `sitemapAsSingleFile()`），沒有阻塞項。
- [ ] **X / Twitter handle**。現況：站主目前無 X 帳號，`SITE.twitterHandle` 為空
      字串，`twitter:site` / `twitter:creator` 不輸出（`site-meta.ts` 註解：空字串
      優於掛一個假帳號）。若站主日後申請帳號，把 handle 填進
      `SITE.twitterHandle` 即可自動輸出。
- [ ] **squirrelscan 雲端帳號**。現況：總分（Overall/SEO/Performance/Security/
      Agents 的排行榜式分數）需要 `squirrel auth login` 綁定雲端帳號才能取得；
      CI 的 `seo-daily.yml` 用 `--offline` 執行，只取本地稽核的四項分數（SEO/
      Performance/Security/Agents），不受影響。目前以這四項本地分數當驗收基準，
      沒有雲端總分可比對。若要接雲端帳號，需要站主提供 squirrelscan 帳號憑證。

## B. 內容工作（非技術修復，需要站主判斷）

- [ ] **3 條外部死連結**，需站主決定替換或移除：
  - `https://charlsondou.com/get-instagram-api-token-auto-update/#...`（timeout），
    出現在 `/n8n-instagram-access-token`。
  - `https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md`
    （404），出現在 gemini-cli 那篇（`/google-new-opensource-too-gemini-cli-...`）。
  - `https://your.wordpress.url/wp-json/wp/v2/media)，WordPress...`（連線失敗），
    出現在 `/n8n-notion-wordpress-publish-automation`。這條其實不是真的外部連結，
    是文章內的**範例網址**被 markdown 連結語法誤吞了後面的中文與括號（`)` 被當成
    連結語法的一部分）。修法：把這段範例網址改成純程式碼片段（` `` ` 包起來）
    而非 markdown 連結，不需要對外請求就能修好。
  - 另外 LinkedIn（`https://www.linkedin.com/in/frankchen0130/`）回 999 是該站
    對爬蟲的反制行為，不是實際死連結，已評估標記為忽略，不需處理。
- [ ] **內容過薄頁面**（squirrelscan word-count 警告，15 篇低於 300 字門檻）。
      屬於內容工作而非技術修復——是否要為這些頁面補內容，或接受它們本來就是
      短篇幅（例如工具速查／單一問題解法），需要站主逐篇判斷。
- [ ] **Keyword stuffing 警告**（squirrelscan 標記 25 頁有詞彙過度重複的疑慮）。
      需要站主逐篇檢視是否為技術文件常見的必要重複用詞（例如同一個 API 名稱、
      工具名稱反覆出現），或是真的需要改寫，非技術面可自動判斷的問題。
- [ ] **4 篇 meta description 需人工複檢**（本次批次補齊時寫的內容有下列疑慮，
      需要站主對照原文確認是否準確）：
  - `n8n-credentials-setup-complete-guide`：描述裡列入了 Google，但撰寫時未逐字
    驗證該文是否確實包含 Google 相關段落。
  - `nginx-cache-wordpress`：描述裡「用 X-Cache-Status 驗證命中率」一句是由標題
    結構推得，並非直接摘自正文，需確認正文是否真的有這段操作。
  - `raspberry-pi-gpio-high-frequency-noise`：描述把正文提到的 350 kHz 電刀頻率
    寫成了「干擾源頻率」，需確認這個因果關係在正文裡是否成立。
  - `flutter-study-materialapp-vs-cupertinoapp`：原描述結尾有 `…` 截斷殘留，
    語意不完整，需要補完整句。

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
