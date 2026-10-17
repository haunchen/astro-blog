---
title: "Zeabur 停止營運怎麼搬家：我用 Claude Code 把 8 個服務搬出 Zeabur 的實際流程"
date: 2026-10-17
description: "Zeabur 宣布 2026 年底停止營運，共享叢集 12 月 1 日就暫停。這篇用我 7 月實際搬走 8 個服務的流程，講盤點、依服務類型選落點、資料庫與 n8n 備份、DNS 零空窗切換、批次驗收與網域轉出，以及哪些步驟可以交給 Claude Code，哪些一定要自己按。"
category: "devops"
tags: ["deployment", "Cloudflare"]
cover: "./images/cover.webp"
---
## 前言：你的死線不是 12 月 31 日

Zeabur 在 2026 年 10 月 17 日寄信宣布停止營運。信裡最該畫線的是這句：

> 12 月 31 日是平台服務全部停止的最終日期，並不意味著每項服務都能持續運行到當天。

實際的死線依你用的服務而不同：

| 你用的是 | 死線 |
|---------|------|
| 共享叢集 | 12 月 1 日起所有服務暫停（可手動恢復來備份資料） |
| 專用伺服器 | 12 月 1 日起停止續費，依各自到期日在 12 月陸續關閉 |
| 全部 | 12 月 31 日停止 |
| 資料刪除日、最晚匯出期限 | 還沒公布 |

如果你在共享叢集上，從公告那天算起只剩 45 天。

我 7 月剛好搬過一次。當時 Zeabur 上有 8 個服務：一個 nginx 反向代理、WordPress 加 MariaDB 加 Redis，以及 4 個用 Caddy 跑的靜態 landing page。搬家的原因跟後來的事件無關，是 WordPress 已經被我自己寫的 Astro 部落格取代，剩下的東西沒理由再放在那裡。

實際動手那個晚上，前後大概一到兩個小時。大部分操作不是我做的：我把 Zeabur 的 MCP 和 Cloudflare 的 MCP 都接上 Claude Code，讓它去盤點、建專案、改 DNS，我負責審核和按下幾個它按不到的按鈕。

這篇把當時的流程整理成你現在可以照做的順序。我實際做過的會寫出當時的數字和踩到的坑；資料庫、n8n、網域轉出這三塊我當時沒有用到，只能寫通用步驟，會在段落裡標明。

> 開始搬之前，先處理資安。Zeabur 在 8 月和 10 月兩度被入侵，環境變數裡的憑證要當成已經外洩。輪替的順序與該檢查什麼，我寫在〈[從 Zeabur 兩次資安事件學到的事](/zeabur-incident-permission-blast-radius/)〉的「還在 Zeabur 上，先做這幾件」那一節。這篇不重講，只提醒一件事：**新的金鑰直接放到新平台，不要再寫回 Zeabur。**

## 第一步：先盤點，不要先搬

我讓 Claude Code 做的第一件事不是搬，是盤點，而且只用唯讀的操作，什麼都不改。

盤點要回答四個問題：

1. 有哪些服務？每個是什麼類型（靜態站、應用程式、資料庫、快取）
2. 每個服務在共享叢集還是專用伺服器？這決定你的死線
3. 哪些服務有狀態？資料庫、上傳的檔案、volume 裡的東西，搬家時要另外處理
4. 哪些網域指向 Zeabur？

前三題 Zeabur 的控制台或 MCP 就看得到。第四題要去 DNS 那邊查，而這一步通常會有意外收穫：我當時掃出 3 筆指向 Zeabur、但早就沒在用的死紀錄。不清掉的話，Zeabur 關掉之後它們會變成懸空的 DNS 紀錄，有被別人接手的風險。

我還讓 Claude Code 把 nginx 的設定檔用唯讀指令完整抓下來，存進 git。這是搬家時最容易遺失的東西：反向代理裡寫了哪些路徑轉到哪裡，平常沒人記得，平台一關就沒了。

> 存設定檔時，環境變數只存「名稱」，不存值。值屬於秘密，搬家時從各服務商後台重新產生，不從舊平台複製。

我當時盤點出來的結果長這樣，你可以照這個格式列自己的：

| 服務 | 類型 | 有沒有狀態 | 綁定網域 | 去處 |
|------|------|-----------|---------|------|
| nginx | 反向代理 | 無，但設定檔要備份 | `www.frankchen.tw` | 不再需要，路由改由 Cloudflare 處理 |
| WordPress | 應用程式 | 有（上傳檔案） | 經 nginx 對外 | 封存後拆除 |
| MariaDB | 資料庫 | 有 | 無 | 隨 WordPress 封存 |
| Redis | 快取 | 無 | 無 | 直接拆 |
| 4 個靜態站（個人頁、n8n-skills、n8nManager、PDFKey） | 靜態站 | 無 | 經 nginx 以子目錄對外 | 3 個改成獨立子網域放 Cloudflare Pages，個人頁併入新部落格的 `/about/` |

## 第二步：依服務類型決定落點

Zeabur 的方便在於什麼都能丟上去。搬家時要反過來想：每一種服務各自適合去哪裡。

| 服務類型 | 建議落點 | 我的情況 |
|---------|---------|---------|
| 靜態站、landing page、純前端 | Cloudflare Pages、GitHub Pages、Netlify | 3 個 landing page → Cloudflare Pages |
| WordPress | 能靜態化就靜態化；要留後台就去 VPS 或 WordPress 代管主機 | 已被 Astro 取代，封存後直接拆 |
| 資料庫（PostgreSQL、MySQL） | 代管資料庫服務，或跟應用程式一起放 VPS | 沒用到 |
| n8n 等需要常駐、有狀態的服務 | VPS 或自家機器加 Docker | 我的 n8n 本來就跑在家裡的 Linux |

我不推單一平台，原因是 Zeabur 這次教的事：所有東西放在同一個地方，那個地方一出事就全部一起出事。靜態站放 Pages 幾乎零維護，值得搬過去；有狀態的服務就沒有那麼輕鬆的去處，得接受自己顧一台機器，或付錢給代管服務。

## 第三步：靜態站搬到 Cloudflare Pages

這是最簡單的一類，也是我實際做過的部分。

如果你的靜態站原本是從 GitHub repo 部署到 Zeabur，到 Cloudflare Pages 新增一個專案、連同一個 repo，設定好建置指令和輸出目錄就好。我兩個 landing page 的輸出目錄是 repo 裡的子資料夾，建置時要指定子目錄，不是 repo 根目錄。

這一段 Claude Code 透過 Cloudflare 的 API 全部做完：建 Pages 專案、觸發部署、綁 custom domain、補 DNS。最後再用瀏覽器打開兩個站，確認畫面正常。

踩到的兩個坑：

**坑一：只改產出檔，會被 CI 打回去。** 我的 landing page 有一支腳本會自動產生 sitemap，裡面把舊網址寫死了。手動改 sitemap 之後，下一次 push 觸發 CI，又被改回舊網址。要改的是產生器裡的 `BASE_URL`，還有 HTML 範本裡寫死的 canonical。搬家時順便搜一下 repo 裡有沒有寫死舊網域：

```bash
grep -rn "舊網域.tw" --include="*.py" --include="*.html" --include="*.js" .
```

**坑二：子網域一直 301，兇手不是你以為的那個。** 新站部署好、DNS 也改了，打開子網域卻一直被 301 到別的地方。我第一個懷疑是 Page Rule，實際查下來 Page Rule、Redirect Rule、Bulk Redirect 全部是 0 條。真正的原因是我很久以前寫的一支 Cloudflare Worker，還綁著那個子網域的 route。移掉那條 route，馬上就回 200 了。

如果你在 Cloudflare 上遇到「改了 DNS 但行為沒變」，記得連 Worker 的 route 一起查。

## 第四步：WordPress，先封存再決定

我的 WordPress 是要拆掉的，所以重點在「拆之前確認沒有東西會遺失」。我讓 Claude Code 查了三件事：

- 資料庫最後一次異動是什麼時候？答案是 2026 年 1 月 25 日，之後都沒動過
- 留言要不要留？577 筆，核准數 0，全是垃圾
- 媒體檔案在哪裡有備份？

確認完，封存兩份：

1. **All-in-One WP Migration 匯出的 `.wpress` 檔**：我那份 747MB，包含全部上傳檔案和資料庫的 SQL
2. **WordPress 內建的 WXR 匯出**（後台「工具」→「匯出」）：純文字的文章、頁面、分類，任何系統都讀得到

兩份一起放進外接硬碟的封存資料夾，旁邊附一份 README，寫清楚這是什麼、什麼時候備份的、怎麼還原。半年後的你不會記得 `.wpress` 是什麼格式。

如果你要繼續跑 WordPress（這段我沒有實作），最直接的路是在新主機裝好 WordPress 和同一個外掛，匯入 `.wpress`。要注意外掛的免費版對匯入檔案大小有限制，檔案太大要先處理，或改用手動搬資料庫加 `wp-content` 資料夾。

## 第五步：資料庫與 n8n（通用步驟）

這一段我當時沒有用到，以下是通用做法，請邊做邊驗證。

### 先恢復服務，再備份

共享叢集 12 月 1 日起會暫停服務。暫停之後要備份，得先在控制台手動恢復服務，資料庫跑起來了才 dump 得出來。不要等到那時候，現在就先做一次備份。

### PostgreSQL

從 Zeabur 服務頁面取得連線資訊（host、port、帳號、密碼），在本機執行：

```bash
pg_dump -Fc -h <host> -p <port> -U <user> -d <dbname> -f backup.dump
```

`-Fc` 是自訂格式，檔案比較小，還原時可以挑表。還原到新的資料庫：

```bash
pg_restore -h <新host> -p <port> -U <user> -d <dbname> --no-owner backup.dump
```

`--no-owner` 讓還原出來的物件屬於新環境的使用者，不會因為舊角色不存在而報錯。

### MySQL、MariaDB

```bash
mysqldump -h <host> -P <port> -u <user> -p --single-transaction --routines <dbname> > backup.sql
```

`--single-transaction` 讓 InnoDB 在不鎖表的情況下拿到一致的快照，`--routines` 會把預存程序一起帶走。

### n8n

n8n 的 workflow 與 credentials 可以用 CLI 匯出：

```bash
n8n export:workflow --all --output=workflows.json
n8n export:credentials --all --output=credentials.json
```

匯出的 credentials 是加密過的，**解密用的是環境變數 `N8N_ENCRYPTION_KEY`**。新環境沒設同一把，匯入的帳號密碼全部解不開。這是 n8n 搬家最常見的坑。

這裡有個矛盾要處理：這把加密金鑰本身也在 Zeabur 的環境變數裡，照事件的處理原則應該視為已外洩。比較乾淨的做法是在新環境用新的加密金鑰，credentials 逐一重新填入，順便完成輪替。workflow 不多的話這樣做最安全；很多的話，至少先用舊金鑰搬過去讓服務不中斷，再排時間把 credentials 全部換新。

### 驗證

不要看到備份檔就當作完成。還原到新環境之後，挑幾張重要的表比對筆數，打開應用程式實際跑一次主要功能。檔案存在和資料完整是兩回事。

## 第六步：DNS 切換，零空窗的順序

我的做法是：**新的先全部就位，最後才拆掉舊的。**

1. 新平台部署完成，先用平台給的臨時網址（例如 `xxx.pages.dev`）把功能測過一輪
2. 在新平台綁上 custom domain
3. 到 DNS 把紀錄改指向新平台
4. 確認新網址正常
5. 舊服務先停用，觀察幾天沒問題才刪除

我當時主網域的流量是被一支 Worker 攔著的，所以第 3 步改完 DNS 之後行為不會變，等最後拆掉 Worker route 的那一瞬間，流量才切到新站。原本預期會有幾十秒到幾分鐘的錯誤頁，實際是零空窗。

順序反過來（先拆舊的再補新的），中間那段時間訪客看到的就是錯誤頁。

如果你的網址搬過去之後完全不變，DNS 改完就結束了，不需要做轉址。只有趁搬家順便改了網址結構（換網域、路徑改名、`www` 改成不帶 `www`）才需要替舊網址做 301。我屬於後者：我趁這次把主站從 `www` 改成不帶 `www` 的網域，所以多了一條 Cloudflare 的 Redirect Rule。這一步 Claude Code 做不到，它手上的 API token 沒有 Redirect Rule 的寫入權限，最後是我自己進後台建的。

切換完到 Cloudflare 後台清一次快取（Purge Everything），避免訪客拿到舊版本。

## 第七步：批次驗收舊網址

搬家最怕的是舊網址失效：搜尋引擎收錄的、別人文章裡連過來的，全部變 404。

我的做法是把舊站所有文章的網址匯出成清單（WordPress 可以從 WXR 或 sitemap 取），讓 Claude Code 寫一支腳本逐條檢查。核心就是 curl 的這幾個參數：

```bash
#!/usr/bin/env bash
# urls.txt 每行一個舊網址
while read -r url; do
  curl -sL -o /dev/null \
    -w "%{http_code} %{num_redirects} ${url} -> %{url_effective}\n" \
    "$url"
done < urls.txt
```

`-L` 會跟著轉址走到底，`%{http_code}` 是最終狀態碼，`%{num_redirects}` 是中間轉了幾次。要看的是兩件事：最終狀態碼是不是 200，以及轉址次數符合預期（網址沒變應該是 0 次，有改網址的話是 1 次）。轉了兩三次的「轉址鏈」雖然打得開，但對搜尋引擎不友善，也拖慢速度。

我把舊 WordPress 匯出的 42 個網址（35 篇文章加 7 個頁面）丟進去跑，以下是 2026 年 10 月 17 日實跑的輸出節錄：

```text
200 2 https://www.frankchen.tw/archives/ -> https://frankchen.tw/articles/
200 1 https://www.frankchen.tw/privacy-policy/ -> https://frankchen.tw/privacy-policy/
200 1 https://www.frankchen.tw/create-free-ssl-domain-certificates-using-certbot/ -> https://frankchen.tw/create-free-ssl-domain-certificates-using-certbot/
200 1 https://www.frankchen.tw/flutter-firebase-google-authentication-tutorial/ -> https://frankchen.tw/flutter-firebase-google-authentication-tutorial/
200 1 https://www.frankchen.tw/vercel-v0-dev-ubuntu-deploy-web-app/ -> https://frankchen.tw/vercel-v0-dev-ubuntu-deploy-web-app/
```

42 個全部是 200，沒有 404。因為我改了網域，每個舊網址都會轉一次，這是預期中的。第一行的 `/archives/` 轉了兩次：先被 Redirect Rule 從 `www` 轉到不帶 `www` 的網域，再被 Pages 的 `_redirects` 從 `/archives/` 轉到 `/articles/`。如果你的網址沒變，正常結果應該是 `200 0`，完全不轉址。功能上沒問題，但這就是一條轉址鏈。網址一多，靠眼睛看是看不出來的，這也是要寫成腳本逐條跑的原因。

## 第八步：網域轉出（通用步驟）

這一段我沒有做過，我的網域本來就不在 Zeabur 買。

Zeabur 已經開放自助轉出網域。各家註冊商的流程大同小異：

1. 在原註冊商解除轉移鎖定
2. 取得轉移授權碼（auth code，也叫 EPP code）
3. 到新註冊商發起轉入，貼上授權碼、付款
4. 確認信件，等轉移完成

兩個注意事項。第一，網域註冊或轉移後的 60 天內，依規定通常不能再轉移，剛買的網域可能會卡在這裡，要盡早聯絡 Zeabur Support。第二，有些註冊商（例如 Cloudflare Registrar）要求網域先改用它的 nameserver 才能轉入，DNS 紀錄要先搬好，不然轉移過程中網站會斷。

## 第九步：拆除與收尾

驗收沒問題之後再拆。我當時的順序是：

1. 所有服務先改成暫停，觀察
2. 確認新站正常，再刪除服務、刪除專案
3. 取消訂閱

刪除服務和取消訂閱這兩步，Zeabur 的 MCP 當時沒有提供對應的工具，只能自己進控制台按。這兩個都是不可逆的動作，由人來按也比較放心。

Zeabur 這次還有兩件事要申請，信裡寫明是**兩張不同的單**：

- 帳戶餘額退款
- 資安事件的損失賠償

都走 Zeabur Support，申請時寫清楚是哪一項。

## 交給 AI 搬家，要注意什麼

Zeabur 在停止營運的信裡說，會提供給 Claude Code、Codex 這類 coding agent 用的遷移指南與 Skills。我自己的經驗是，這條路確實省時間，但有幾件事要先想好。

**先只給讀的權限。** 第一個階段只讓它盤點。盤點結果看過、確認它理解的架構跟你知道的一致，才進入會改東西的階段。

**它會卡在權限邊界，這是好事。** 我那晚有兩件事 Claude Code 做不到：Redirect Rule 的 API 權限不夠，以及 Zeabur MCP 沒有刪除服務的工具。這兩個都是我自己補上的。權限不夠時，它會停下來告訴你，你再決定要給權限還是自己做。不要為了省事，一開始就給一把全開的 token。

**MCP 和 API token 本身就是憑證。** 這篇的起點是一次憑證外洩事件，搬家時別又製造出一把新的高權限 token 就丟著不管。搬完之後，把為了搬家建立的 Zeabur 和 Cloudflare token 撤銷或縮小權限。

**驗收不能交給同一個 AI 自己說了算。** 它說「部署成功」，你還是要打開網頁看一眼；它說「全部轉址正常」，你要看到那份逐條的輸出。上面那支驗收腳本，就是讓結果變成可以檢查的東西。

## 結語

我那次能在一兩個小時內搬完，前提是 8 個服務裡沒有一個要搬資料庫，大部分的操作又可以交給 Claude Code。你的情況如果有資料庫、有 n8n、有在 Zeabur 買的網域，時間要抓得比我寬很多。

如果你今天只能先做一件事，就先做盤點：列出每個服務、它的死線、它有沒有狀態。列完你就知道自己是 45 天後要搬完，還是還有一點餘裕。

## 常見問題

**共享叢集和專用伺服器的死線差在哪？**

共享叢集 12 月 1 日起全部暫停，專用伺服器依各自到期日在 12 月陸續關閉，最晚 12 月 31 日。

**12 月 1 日之後，共享叢集的資料還救得回來嗎？**

官方說暫停後仍可手動恢復服務來備份，但資料刪除日還沒公布，建議現在就先備份一次。

**搬到新平台後，環境變數可以照抄嗎？**

不建議。Zeabur 兩度被入侵，舊值要當成已外洩，應該到各服務商重新產生後放進新平台。

**Zeabur 的替代方案推薦哪個？**

依服務類型分：靜態站用 Cloudflare Pages 等託管服務，有資料庫或常駐服務的放 VPS 或代管資料庫。

## 參考資料

- [從 Zeabur 兩次資安事件學到的事：一把金鑰能走多遠？](/zeabur-incident-permission-blast-radius/)：搬家前的資安處理清單
- [Zeabur 停止營運通知信全文（LINUX DO 論壇轉貼）](https://linux.do/t/topic/3035894)：時程與退款、賠償說明
- [Zeabur Status — Incident 1091243](https://status.zeabur.com/incident/1091243)：10 月事件公告
- [n8n CLI commands](https://docs.n8n.io/hosting/cli-commands/)：workflow 與 credentials 匯出匯入
- [PostgreSQL pg_dump 文件](https://www.postgresql.org/docs/current/app-pgdump.html)
