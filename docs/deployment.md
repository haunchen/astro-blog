# Cloudflare Pages 部署設定

> **注意**：下方「Dashboard 設定步驟」「自訂網域」「部署後驗證」「後續」四節寫於
> cutover 之前，內容停留在「還在 `*.pages.dev`、尚未切 frankchen.tw」的狀態。實際上
> cutover 已於 2026-07-19 完成，正式站就是 frankchen.tw。那幾節目前只有歷史參考價值，
> 待整份改寫；「連續部署的空窗期」一節則是現行有效的操作須知。

## Dashboard 設定步驟

1. CF Dashboard → Workers & Pages → Create → Pages → Connect to Git
2. 選 repository：`haunchen/astro-blog`
3. Production branch：`main`
4. Build configuration：
   - Framework preset：**Astro**
   - Build command：`npm run build`
   - Build output directory：`dist`
   - Root directory：`/`
5. Environment variables：
   - `NODE_VERSION` = `20`
6. Save and Deploy

## 自訂網域

frankchen.tw 自訂網域**先不切**。理由：
- 現有 frankchen.tw 在 WordPress / Zeabur 服務 31 篇舊文章
- 直接切過去等於老文章瞬間 404
- 等 `scripts/sync-from-vault.mjs` 跑完 35 篇 WordPress 文章 + 寫好 `public/_redirects` 後再 cutover

## 部署後驗證

Production 部署完成（CF Pages 提供 `*.pages.dev` URL）後，跑以下驗證：

```bash
PAGES_URL="https://YOUR-PROJECT.pages.dev"

# 安全標頭
curl -sI "$PAGES_URL/" | grep -iE 'x-frame|x-content|referrer|permissions'

# robots.txt / llms.txt / rss.xml 都 200
for path in /robots.txt /llms.txt /rss.xml /sitemap-index.xml; do
  echo "=== $path ==="
  curl -sI "$PAGES_URL$path" | head -1
done

# OG 圖
curl -sI "$PAGES_URL/og/test-markdown-rendering.png" | head -1
```

JSON-LD 驗證：
- 開 https://search.google.com/test/rich-results
- 輸入 `$PAGES_URL/test-markdown-rendering/`
- 應辨識出 BlogPosting + BreadcrumbList

OG 圖預覽驗證：
- 開 https://developers.facebook.com/tools/debug/
- 輸入文章 URL，看 OG 預覽是否正確

## 連續部署的空窗期

**短時間內連續合併兩個會改動建置產物的 PR，中間有一段邊緣快取不一致的窗口，站上部分
頁面會沒有樣式。合完第一個之後隔約 10 分鐘再合第二個。**

機制：CF Pages 的正式網域只服務「最新那一次部署」，前一次部署的雜湊資產隨即消失。
而 HTML 在邊緣的存活期是 `public/_headers` 給的 `max-age=600, must-revalidate`——所以
第二次部署完成後的十分鐘內，邊緣上仍有一批舊 HTML，指向已經不存在的資產網址。

因為 `astro.config.mjs` 的 `cssCodeSplit: false` 讓全站共用一支 CSS，撞到的話症狀不是
少一個小檔案，而是整頁沒有樣式。

實例（2026-07-31）：`/index.md` 與站台 `AGENTS.md` 兩個 PR 連續 squash merge，
`npm run verify:assets` 抓到 `/_astro/style.BtwJjWgg.css → 404`，影響 `/articles/`
與 `/cloudflare-cache-rules-wordpress/`。未做任何處置，約十分鐘後自行恢復（全站改為
指向新的 `style.DcrQlsTB.css`）。

### 與 2026-07-23 事故的分辨方式

兩者症狀相同（頁面沒樣式）但處置完全相反，別搞混：

| | 2026-07-23 事故 | 連續部署空窗期 |
|---|---|---|
| 壞掉的是 | 資產本身被邊緣快取成 404 | HTML 是舊的，資產沒問題 |
| 會自行恢復嗎 | **不會**，要去 Purge 該 URL | 會，等 HTML 的 TTL 過 |
| 判斷依據 | 反覆重跑仍是同一個資產 404 | 重跑後資產雜湊已變、全部 200 |

`verify-assets` 在這種情況下的診斷訊息會誤導：它會說「繞過快取也拿不到，檔案本身不在
該次部署裡——問題在建置或部署，不是快取」。那句話對「資產」而言字面正確（它確實不在
最新部署裡），但根因在 HTML 端不在資產端。**看到這句話時先隔幾分鐘重跑一次**，資產
雜湊若已改變且全部 200，就是這裡講的空窗期，不需要 Purge 也不需要查建置。

## 後續

frankchen.tw cutover 屬另一個 milestone，需要：
1. `sync-from-vault.mjs` 把 35 篇 WordPress 文章搬進 Astro
2. `public/_redirects` 含舊 slug 對新 slug 的 301
3. WordPress 端關閉或設好 301
4. CF Pages 加入自訂網域、DNS 切換
