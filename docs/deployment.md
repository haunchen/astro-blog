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

> **已完成（2026-07-22）**：cutover 已執行，正式站即 `https://frankchen.tw`（apex）。
> 以下為當時的判斷紀錄，保留脈絡用。

frankchen.tw 自訂網域**先不切**。理由：
- 現有 frankchen.tw 在 WordPress / Zeabur 服務 31 篇舊文章
- 直接切過去等於老文章瞬間 404
- 等 `scripts/migrate-wp.mjs` 跑完 35 篇 WordPress 文章 + 寫好 `public/_redirects` 後再 cutover

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

> **已完成（2026-07-22）**：四項全數執行完畢，Zeabur／WordPress 已退役。保留為當時的檢查清單。
>
> 注意 `sync-from-vault.mjs` 不是做這件事的腳本——WordPress 那 35 篇是 `migrate-wp.mjs`（WXR 匯入）
> 搬的。`sync-from-vault.mjs` 是 vault→blog 的發布管線，2026-08-19 才實作，見
> `docs/plans/2026-08-19-sync-from-vault-design.md`。

frankchen.tw cutover 屬另一個 milestone，需要：
1. `migrate-wp.mjs` 把 35 篇 WordPress 文章搬進 Astro
2. `public/_redirects` 含舊 slug 對新 slug 的 301
3. WordPress 端關閉或設好 301
4. CF Pages 加入自訂網域、DNS 切換

## DNS 記錄（zone 層，不在 repo）

以下記錄由 Cloudflare zone 提供，**repo 裡沒有任何東西會產生它們**。唯一的守門人是
`npm run verify:dns-aid`（打線上、查 DoH），改動 zone 後請跑一次。

### DNS-AID：`_index._agents`

```
_index._agents.frankchen.tw. 3600 IN HTTPS 1 frankchen.tw. alpn="h2,http/1.1" port=443
```

Dashboard 欄位對照（DNS → Records → Add record）：

| 欄位 | 值 |
|---|---|
| Type | `HTTPS` |
| Name | `_index._agents` |
| TTL | `1 hour` |
| Priority | `1` |
| Target | `frankchen.tw.` |
| Value | `alpn="h2,http/1.1" port=443` |

兩個會靜默失效的填法：

- **Priority 填 0** → AliasMode，isitagentready 的掃描器會算進 `aliasRecordCount` 而非
  `serviceRecordCount`，記錄看起來建好了卻不算數。
- **Target 留空或填 `.`** → `.` 在 SVCB 語意上代表 owner name，即 `_index._agents.frankchen.tw`，
  含底線，違反 draft-mozleywilliams-dnsop-dnsaid §3.2 的 MUST（該處要用公開 x.509 憑證通訊）。

型別用 `HTTPS`(65) 而非 `SVCB`(64)：RFC 9460 定義的 HTTPS 本就是 https-scheme 的特化型，而本站
入口確實是 HTTPS 端點。理由詳見 `docs/plans/2026-08-03-dns-aid-discovery-design.md`。

**不發 `_a2a._agents` 與 `_mcp._agents`**：本站沒有 A2A agent 也沒有 MCP server，宣告它們會讓
agent 連過來撲空。`verify:dns-aid` 有一條反向斷言確保這兩個名稱維持不存在。

查詢這筆記錄時會看到兩種格式，**都是正常的**：

```
Cloudflare DoH → "\# 38 00 01 09 66 72 61 6e 6b 63 68 65 6e 02 74 77 00 ..."   （RFC 3597 wire format）
Google DoH     → "1 frankchen.tw. alpn=h2,http/1.1 port=443"                    （presentation format）
```

CF 的 DoH JSON 只對**自己為 proxied 名稱自動產生**的 HTTPS 記錄轉成 presentation format；
**手動建立**的記錄一律回十六進位 wire format，與 RR 型別無關。看到 hex 不代表建錯型別——
要確認型別，查 `type=SVCB` 應為 NODATA、`type=HTTPS` 才有答案。`verify:dns-aid` 兩種格式都讀得懂。

2026-08-03 實建確認 Cloudflare **不會**拒絕或覆寫這筆手動 HTTPS 記錄（`_index._agents` 底下無
A/AAAA、不是 proxied 名稱）。原先預留的退路（改發 SVCB(64)）用不上。

### DNSSEC

**必須啟用**——不是本記錄的規格要求，而是外部檢測的通行條件。DNS-AID 的 draft 對未併用 TLSA 的
記錄只要求 SHOULD，但 isitagentready 實測把它當必要條件：記錄的每一欄都被認可
（`validServiceMode: true`、`validationIssues: []`）後，`dnsAid.status` 仍是 `fail`，訊息為
「records found, but DNSSEC was not validated」。

啟用步驟：

1. Cloudflare DNS → Settings → DNSSEC → Enable DNSSEC，取得 DS 記錄（Key Tag／Algorithm／
   Digest Type／Digest）
2. 到 **.tw 的註冊商**填入該 DS——那是 Cloudflare 之外的第三方介面
3. 等父區（`tw`）更新後驗證：

   ```bash
   curl -s -H 'accept: application/dns-json' \
     'https://cloudflare-dns.com/dns-query?name=frankchen.tw&type=A&do=1'
   ```

   回應的 `"AD": true` 即為成功。`npm run verify:dns-aid` 也會斷言這一項。

**風險**：DS 填錯、或日後 Cloudflare 換 KSK 而註冊商端的 DS 未同步，會讓驗證型 resolver
**直接解不出 frankchen.tw**——全站不可達，不是效能退化。真出事的回復方式是到 CF 關閉 DNSSEC，
或到註冊商移除 DS 記錄。
