# Cloudflare Pages 部署設定

> 一次性手動設定，無自動化。本次先使用 `*.pages.dev` 預設網域，不切自訂網域。

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

## 後續

frankchen.tw cutover 屬另一個 milestone，需要：
1. `sync-from-vault.mjs` 把 35 篇 WordPress 文章搬進 Astro
2. `public/_redirects` 含舊 slug 對新 slug 的 301
3. WordPress 端關閉或設好 301
4. CF Pages 加入自訂網域、DNS 切換
