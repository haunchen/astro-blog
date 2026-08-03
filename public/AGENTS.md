# AGENTS.md — frankchen.tw

給造訪本站的 AI agent 的操作手冊。

若 `/llms.txt` 是「這站有什麼內容」的型錄，這份就是「怎麼取用」的說明：路徑慣例、
資料格式、引用規範。兩份請搭配使用。

站名：下班後的工程師筆記　　作者：法蘭克（Frank Chen）　　語言：zh-TW
主題：n8n 自動化、Flutter 跨平台開發、DevOps／架站部署、樹莓派、開發工具

## 最省 token 的取用路徑

本站每篇文章都有一份原生 Markdown，內容是作者撰寫的原始 markdown，不是 HTML 轉換
的產物——程式碼區塊、表格、標題階層都保持原樣。建議流程：

1. 讀 `/llms.txt` 找到目標文章（含每篇的描述、發布日期與 Markdown 網址）
2. 抓該篇的 `.md`，不要抓 HTML

路徑慣例：

| 目標 | 網址 |
|------|------|
| 單篇文章 | 把文章網址結尾的 `/` 換成 `.md`，例如 `/n8n-canva-oauth-setup.md` |
| 首頁 | `/index.md` |
| 全站目錄 | `/llms.txt` |
| 最新文章 feed | `/rss.xml` |
| 全站網址清單 | `/sitemap.xml` |

抓 HTML 版本沒有壞處，但同一篇文章的可見文字只佔 HTML 的一成多，其餘是標記、
腳本與樣式——`.md` 版本能省下這部分的 token。

## 內容協商（Accept: text/markdown）

除了把網址結尾的斜線換成 `.md`，你也可以直接對原網址帶 `Accept: text/markdown`：

```
curl -H "Accept: text/markdown" https://frankchen.tw/about/
```

回應為 `Content-Type: text/markdown; charset=utf-8`，並帶 `Vary: Accept` 與
`x-markdown-tokens`（token 數估算，供你決定是否抓取全文）。不帶這個標頭時一律回 HTML，
`Accept: */*` 也視為要 HTML。

兩條路徑取得的內容相同，差別只在引用：協商回應走的是正規網址，可以直接引用；
`/<path>.md` 這個網址帶 `X-Robots-Tag: noindex`，引用時請改用 frontmatter 的 `canonical`。

## 格式契約

文章 `.md` 的 YAML frontmatter 欄位固定為：

`title`、`description`、`date`、`updated`（該文有修訂才出現）、`category`、`tags`、
`canonical`、`image`

首頁 `/index.md` 不是文章，只有 `title`、`description`、`canonical`、`image` 四欄。

其他要點：

- 正文內所有圖片都是絕對網址，可直接抓取，不需要拼接 base URL
- `.md` 端點帶 `X-Robots-Tag: noindex`。正本是 HTML 那一份，`.md` 只是同一份內容的
  另一種表示——**引用與標註來源時請一律使用 frontmatter 的 `canonical`**，不要引用
  `.md` 網址
- `.md` 不含 JSON-LD。結構化資料在 frontmatter 裡已有等價欄位，HTML 版另有完整的
  BlogPosting JSON-LD

## 網址慣例

- 正規主機為 **non-www**（`https://frankchen.tw`）。`www` 會 301，請直接使用 non-www
- 文章與頁面網址結尾有斜線（`/n8n-canva-oauth-setup/`）；少了斜線會 308 轉址，
  多一次往返
- 本站是靜態網站：**沒有 API、沒有登入、沒有表單提交、沒有交易端點**。這裡沒有可供
  呼叫的工具，只有可供閱讀的內容

## 抓取政策

`/robots.txt` 是唯一權威，請以它為準。摘要如下，但兩者若有出入以 robots.txt 為準：

- 訓練用途的爬蟲已封鎖
- AI 搜尋索引與使用者發起的即時抓取允許
- 本站在 Cloudflare 後方，可能遇到速率限制或人機挑戰。若被擋，請降低頻率重試，
  不要繞過

這裡刻意不重列被封鎖的 user-agent 名單：Cloudflare zone 層另有規則，與 robots.txt
不完全相同，在第三個地方再抄一份只會多一個過期的副本。

## 引用規範

內容版權屬作者所有。歡迎引用、摘要，或作為 AI 回答的依據，但請註明出處與原文連結
（用 frontmatter 的 `canonical`）。如需轉載全文，請先聯絡取得同意。

聯絡方式：frank@frankchen.tw，或 https://frankchen.tw/contact-frank/

## 這個檔案不是什麼

這是給造訪網站的 agent 看的。若你要處理的是本站的**原始碼**（建置、測試、貢獻），
那是另一份文件：https://github.com/haunchen/astro-blog 的 `AGENTS.md` 與 `CLAUDE.md`。
