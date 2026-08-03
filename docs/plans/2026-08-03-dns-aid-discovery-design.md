# DNS 層的 agent 入口宣告（DNS-AID）

- 日期：2026-08-03
- Domain：`agent-markdown`（brownfield delta，新增 R9 / S9 / D11）
- 起因：isitagentready 掃描回報「DNS for AI Discovery (DNS-AID) well-known entrypoint records not found」

## 掃描器實際做什麼

對正式站跑一次 `POST https://isitagentready.com/api/scan`，`checks.discoverability.dnsAid`
的 evidence 逐條列出它的 7 個 DoH query：

```
SVCB  / HTTPS  _index._agents.frankchen.tw
SVCB  / HTTPS  _a2a._agents.frankchen.tw
SVCB  / HTTPS  _mcp._agents.frankchen.tw
TXT            _index._agents.frankchen.tw
```

全部走 `https://cloudflare-dns.com/dns-query?...&do=1`，判定欄位是
`serviceRecordCount`／`aliasRecordCount`／`txtIndexEntryCount`／`dnssecValidated`。

frankchen.tw 現況（2026-08-03 實測）：NS 在 Cloudflare（`edward`／`lina.ns.cloudflare.com`），
full zone；三個 `_agents` 名稱全部 NXDOMAIN；DNSSEC 未啟用（DS 無 Answer、所有回應 `AD:false`）。

## 前提衝突與取捨

DNS-AID 的用途是「把 AI agent 發布到 DNS 供其他 agent 發現」，而本站是純靜態內容部落格，
**沒有任何 agent 端點**——同一份掃描裡 `a2aAgentCard` 與 `mcpServerCard` 也都是 fail，那是實情
而非疏漏。照字面把 `_a2a._agents`／`_mcp._agents` 一起發滿，等於在 DNS 宣告不存在的服務，
agent 依記錄連過來會撲空，比沒有記錄更糟。

這與既有 D10（api-catalog）是同構的處境，處置沿用同一套判斷：**只宣告既有資源，不編造概念**。
因此只發 `_index._agents` 一條——它的語意是「這個網域對 agent 的入口在這裡」，本站確實有這個入口。

規格本身的份量也影響了投入程度：draft-mozleywilliams-dnsop-dnsaid-02（2026-05-27）是
individual submission，文件內自述「not endorsed by the IETF, no formal standing」。它依賴的
RFC 9460（SVCB/HTTPS）才是正式標準。所以設計上只用 RFC 9460 已註冊的機制，不碰 draft 專屬的東西。

## 記錄內容

```
_index._agents.frankchen.tw. 3600 IN HTTPS 1 frankchen.tw. alpn="h2,http/1.1" port=443
```

### 為何是這些參數

draft §3.2 對 `_index` 的要求比預期寬鬆：「The data provided at `_index._agents.{domain}`,
protocols and schemas are out of scope for DNS-AID」——沒有強制任何 SvcParamKey，只要求
TargetName 必須存在且不含底線（該處要用公開 x.509 憑證通訊），指向 `frankchen.tw.` 剛好合法。

`alpn` 與 `port` 都是 RFC 9460 正式註冊的 key，值也是實情（本站確實走 h2／http1.1 的 443）。

**不用實驗參數指路**：draft 的 `well-known`／`cap`／`cap-sha256`／`policy`／`realm` 五個 key
全部 pending IANA、連數字都還沒配（draft 自己也沒建議數字，SKILL.md 只說實驗性質請用 `keyNNNNN`）。
自挑一個私有號等於發明只有自己看得懂的語意，日後 IANA 配號還會對撞。

**刻意不加 `mandatory=alpn,port`**（SKILL.md 範例有）：`mandatory` 的語意是「不認得這些 key 的
client 必須整筆丟棄」。這條記錄存在的全部目的就是要被成熟度不一的 agent 看見，加上去是對自己設路障。

於是記錄只回答一個問題：入口主機是 frankchen.tw、443、h2。**其餘細節交給已上線的 HTTP `Link`
標頭**（R8）——agent 連上 443 打個 HEAD 就拿到 `/AGENTS.md`（describedby）、`/llms.txt`（index）、
`/index.md`、`/rss.xml`。DNS 不重述 HTTP 層已經講清楚的事，也就沒有第二份會漂移的副本
（同 D9／D10 的一貫判斷）。

## 為何是 HTTPS(65) 而非 SVCB(64)

實測 DoH JSON 對兩種型別的回傳格式不同：

```
HTTPS(65)  cloudflare.com     → data: "1 . alpn=h3,h2 ipv4hint=104.16.132.229 ..."
SVCB(64)   _dns.resolver.arpa → data: "\# 103 00 01 03 6f 6e 65 03 6f 6e 65 ..."
```

Cloudflare 的 DoH JSON **只把 HTTPS 轉成 presentation format，SVCB 回 RFC 3597 未知型別的
十六進位 wire format**（Google DoH 行為相同）。影響有二：驗證腳本得自己解 RFC 9460 的二進位
SvcParams；而**掃描器走的是同一條 CF DoH**，它要分辨 ServiceMode／AliasMode 就得解那串 hex，
解不解得了是我們無法從外部確認的黑箱。

改用 HTTPS(65) 兩者都消失。這不是取巧：SKILL.md 原文即「ServiceMode SVCB records, **or HTTPS
records for HTTPS endpoints**」，本站入口確實是 HTTPS 端點；RFC 9460 定義的 HTTPS 本來就是
SVCB-compatible 的 https-scheme 特化型。掃描器的 7 個 query 含 `HTTPS _index._agents`，打得到。

代價是換來一個必須實測的前提：CF 對 **proxied 名稱**會自動產生 HTTPS 記錄並忽略手動的。
`_index._agents` 底下沒有 A/AAAA、不是 proxied 名稱，形式上滿足文件講的「all records with the
same name must be DNS-only」，但只能到 dashboard 真的建一次才算數。**若 CF 拒絕或覆寫，退路是
改發 SVCB(64) 並在驗證腳本補一個 wire-format 解析器**——退路存在，只是比較貴。

CF API 的 SVCBRecord 結構為 `data: {priority, target, value}`，`value` 即 SvcParams 字串；
community 有 SVCB 建立異常的回報，這也是把「params 是否被吃掉」列為斷言項的原因。

## 為何不發 TXT `_index._agents`

掃描器的 7 個 query 裡有一個是 `TXT _index._agents`，`txtIndexEntryCount` 也是它四個判定欄位之一，
所以「順手發一筆 TXT」看起來是免費的保險。不做的理由有二：

draft 定義的 `_index._agents` 是 SVCB/HTTPS 記錄，**TXT 不在 draft 的任何一節裡**——那是掃描器
自己的擴充，格式沒有規格可循，寫什麼進去都只是猜。真照猜的格式發，等於在 DNS 放一份沒有標準
背書、只有這一個掃描器看得懂的東西。

更關鍵的是內容會重複：TXT 唯一能塞的就是資源清單或入口路徑，而那正是 HTTP `Link` 標頭（R8）與
`/AGENTS.md` 已經在講的事。多一份就多一個會漂移的副本，且這份副本在 DNS 裡、改動不經 build、
不經 code review——漂移的機率比其他任何一份都高。這是 D9 對 robots.txt、D10 對 api-catalog
做過的同一個判斷。

ServiceMode 記錄本身應該就足以讓 `serviceRecordCount` ≥ 1。若實測發現不發 TXT 就無法 pass，
那是把「有無 TXT」當成判定條件的證據，屆時再帶著實測數據重新評估——而不是現在先猜一個格式發下去。

## DNSSEC：本次不做

draft §3.3.1 的原文是「The records SHOULD be DNSSEC-signed ... **if TLSA records are used they
MUST be signed**」。本案不發 TLSA，因此是 SHOULD 而非 MUST。

不納入本次範圍的理由是風險不對稱：.tw 的 DS 必須上傳到註冊商（repo 外、Cloudflare 之外的第三方
介面），設錯的後果是**全站 DNS 解析失敗**，量級遠大於一條發現記錄帶來的好處。掃描器的
`dnssecValidated` 是 details 欄位，是否影響 pass/fail 未知——先發記錄、實量掃描結果，再決定值不值得。

DNSSEC 的好處本來也不限於本案（全站防 DNS 篡改），適合以獨立議題評估，而不是被一條 agent
發現記錄綁著做。

## Repo 落地與驗證

比 `_headers` 的情況更極端：`_headers` 至少 repo 裡有一份「請求」，DNS 記錄則是 repo 裡
**一行程式碼都不會產生它**，zone 是唯一事實來源，而 zone 沒有版控、沒有 code review。
repo 唯一能貢獻的是一個守門人。

`scripts/verify-dns-aid.mjs` + `npm run verify:dns-aid`，定位同 `verify:headers`／`verify:robots`
（打線上、驗 zone 的東西、吃 origin 參數）。刻意走 CF DoH JSON、失敗 fallback Google——
**與掃描器同一條解析路徑**，才能驗到掃描器會看到的東西，而不是驗到我們自己的想像。

要擋的失效模式，前三種都會靜默通過「記錄存在嗎」式的檢查：

1. **建成 AliasMode**（priority 填 0）→ 掃描器算進 `aliasRecordCount` 而非 `serviceRecordCount`，
   記錄明明在卻不算數。斷言：priority ≠ 0。
2. **CF 把 `value` 吃掉** → 記錄還在、params 沒了。斷言：params 含 `alpn`。
3. **target 寫成含底線的名字** → 違反 draft §3.2 的 MUST。斷言：target 為 `frankchen.tw.` 且無底線。
4. **日後有人在 dashboard 手滑刪掉** → zone 無版控，這支腳本是唯一會叫的東西。

再加一條「DNS 不說謊」的自我約束：對 target 主機發一次 HEAD，必須 200 且帶得回 `Link` 標頭。
拒發 `_a2a`／`_mcp` 的理由是「不宣告不存在的服務」，那就該有東西持續證明 `_index` 宣告的入口是活的。
同理，斷言 `_a2a._agents`／`_mcp._agents` 必須維持 NXDOMAIN——哪天有人為了衝掃描分數偷加兩條，
這是唯一會叫的東西。

## 異動範圍

- `scripts/verify-dns-aid.mjs`（新）、`package.json` 新增 `verify:dns-aid`
- `docs/deployment.md` 新增「DNS 記錄（zone 層，不在 repo）」一節：記錄的權威定義、dashboard
  建立步驟、DNSSEC 為何另案
- `docs/specs/agent-markdown.md` 的 Pending Changes 寫入 R9 / S9 / D11
- **zone 層**（不在 repo）：於 Cloudflare DNS 新增上述 HTTPS 記錄

**不動的**：`public/_headers`、`public/AGENTS.md`、`public/robots.txt`、任何 Astro 原始碼、
`seo-pr.yml`。也不進 `seo-daily.yml`——那支跑的是 squirrelscan，與 dnsAid 無關；另立排程只是
多一個在 DNS 沒事時每天叫一次的東西。維持「改完驗一次、日後懷疑時手動跑」的定位。

## 與既有需求的關係

R9 與 R4（發現管道）、R8（HTTP 層的 Link 標頭）是同一條線的第三層：R4 要求 agent 先解析 HTML
或 llms.txt，R8 讓一個 HEAD 請求拿到指路標，R9 讓 agent 在**建立連線之前**就知道這個網域的入口
在哪。三者皆為補強，R4／R8 文字不動。

## 驗收

1. `npm run verify:dns-aid`（線上）全綠
2. `POST https://isitagentready.com/api/scan` 的 `checks.discoverability.dnsAid.status` 為 `pass`；
   若仍非 pass，記下 `details` 的實際欄位值，作為 DNSSEC 另案評估的輸入
