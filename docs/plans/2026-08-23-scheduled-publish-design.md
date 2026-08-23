# 排程發布（publish-scheduled）— 設計

把「文章已經進 repo、但要等到某一天才上站」這件事自動化：到期由 GitHub Actions
把 `draft` 翻掉並推回 main，Cloudflare Pages 照常部署。

日期：2026-08-23

## 問題

`sync-from-vault`（`docs/plans/2026-08-19-sync-from-vault-design.md`）解決的是「文章怎麼從
vault 進 repo」，它把 `content_status: draft` 的稿子照樣搬進來標 `draft: true`，要發的時候
改一個布林值。那一步至今是純手動——人得記得哪天要發、當天打開檔案、改一行、commit。

排程本身沒有載體。vault 的 `schedule_wordpress` 欄位是 WordPress 時期的遺留，站主已不再
使用（2026-08-23 確認），`schedule-manager` skill 與排程中心 MOC 仍在讀它，屬 vault 端的
另案。也就是說，這裡不能去 vault 拿排程訊號，得自己建一個。

## 範圍

做：repo 內的排程欄位、到期翻牌腳本、每日 cron workflow、驗證防呆。

不做：

- `sync-from-vault` 與 `vault-post.mjs` 一行都不動。第一版 `publishAt` 由人手動在 repo 加
  一行，不加 `--publish-at` flag——那會牽動 `transformPost` 的回傳結構與它 26 個測試，而
  手動加一行的成本是兩秒鐘。要自動化等這條跑順了再說。
- 不碰 vault 端的 `schedule_wordpress` 死路徑（`schedule-manager` skill、排程中心 MOC）。
- 不做社群發文連動。那是 webhook 那條線的事，另案。

## 設計決策

### D1 — 排程訊號住在 repo 的 frontmatter，不回 vault 拿

新增 optional 欄位 `publishAt`。真相來源單一，而且就在 CI 看得到的地方——
`sync-from-vault-design.md` 記的那條硬約束（vault 走 Syncthing／Google Drive，CI runner
看不到它，所以任何排程自動發文只能跑在有 vault 的機器上）在這條路徑上直接不成立，因為
腳本讀的是 repo 裡的 md，不是 vault。

### D2 — 只碰有 `publishAt` 的檔

判定條件是 `draft === true && publishAt <= 今天`，兩個條件都要成立。

這是整個設計的安全性質所在：還在寫的稿只有 `draft: true`、沒有 `publishAt`，所以不論腳本
出什麼錯都不可能把它發出去。「排程中」與「還在寫」這兩種 draft 因此在資料層就分得開，
不必靠腳本的判斷力。

### D3 — 翻牌時 `date` 覆寫成 `publishAt`

`vault-post.mjs:220` 把 vault 的 `created` 映成 repo 的 `date`，所以 `date` 現在的語意是
撰寫日。一篇 8/1 寫好、排 8/28 發的文，`date` 會是 8/1。

翻牌時把 `date` 改寫成 `publishAt`，理由是 sitemap 與 JSON-LD 的 `datePublished` 應該是
上線日：留著撰寫日的話，Google 會看到一篇「一個月前發布」的文章今天才第一次出現。

取 `publishAt` 而非「腳本實際執行那天」，是為了可預期與可重跑——同一份輸入不論哪天跑，
產出的 `date` 都一樣。cron 每天跑，兩者最多差幾小時。

站主 2026-08-23 拍板。此決定只影響之後走排程的文章，既有 36 篇不動。

### D4 — 行級文字改寫，不重新序列化 frontmatter

腳本只做三件事：刪 `draft:` 那行、刪 `publishAt:` 那行、把 `date:` 那行的值換成
`publishAt` 的值。其餘一個字元不動。

不用 gray-matter 讀出來再 `toYamlFrontmatter` 寫回去，理由有三。站上標題大量使用全形冒號，
那支序列化器的 JSON 逃逸規則是為此而寫，整份重寫多一條分岔風險；`updated` 欄位有「與
`date` 同日時不輸出」的條件，重寫會讓它跑掉；而且無關欄位（tags 陣列格式、註解、空行）
會產生大量與這次改動無關的 diff，出事時看不出是哪一行造成的。

`draft: false` 不是留著而是整行刪掉——schema 的 default 就是 false，留著等於寫一個沒有
資訊量的值，與 `updated` 那條慣例同理。

### D5 — 純函式抽 lib，CLI 只是薄殼

判定與改寫兩個純函式放 `scripts/lib/publish-scheduled.mjs`，`scripts/publish-scheduled.mjs`
只負責掃檔、印報告、決定要不要落地。跟 `vault-post.mjs` 同一個形狀，理由也一樣：這段
邏輯之後可能有第二個消費端（Frankify 的 Discord 發布介面），寫進 CLI 就得抄第二份。

### D6 — 預設 dry-run

沿用 `sync-from-vault.mjs` 的慣例：預設只印報告，`--apply` 才寫檔，而且就算 `--apply`
也只改工作區，不 commit 不 push。commit 與 push 由 workflow 負責，人在本機跑這支腳本
永遠不會意外把東西推上站。

### D7 — 日期比較用台北日曆日

cron 一律 UTC，但「2026-08-28 發布」講的是台北時間的 8/28。`0 0 * * *` UTC ＝台北早上
八點，所以判定時要把 `publishAt` 與「現在」都歸算到 `Asia/Taipei` 的日曆日再比大小，
不能直接比 UTC 時間戳——否則台北 8/28 早上八點跑的那一輪，UTC 還在 8/28 00:00，看起來
剛好對，但只要哪天 cron 時間往前挪就會錯一天。

### D8 — 驗證不過就紅燈，不吞錯

workflow 的每一步都不用 `continue-on-error`。翻牌後 `npm run build` 或 `npm run verify:seo`
任一失敗就讓 job 紅燈，並在 Job Summary 寫清楚是哪一篇卡住。理由與 `seo-daily.yml` 檔頭
記的相同：這條 workflow 的價值就在於不用人盯，失敗時看不到原因等於沒有這條檢查。

失敗時不 push，工作區的改動隨 runner 一起消失——那篇文章維持 draft 留在 repo 裡，隔天
cron 會再試一次，同時 GitHub 上有一筆紅燈可查。

### D9 — 沒有到期文章就不 commit

用 `git diff --quiet` 判斷。大多數日子這條 workflow 什麼都不會做，每天留一筆空 commit
會把歷史洗掉。

### D10 — workflow 自己驗證時跑完整 `npm run build`

不能只跑 `astro build`。`subset-fonts.mjs:19` 對 draft 文章直接 `continue`，所以排程稿的
標題與分類從來沒進過字型子集，翻牌後若含新字元，OG 圖會 tofu 而 build 照樣綠（`hardware`
分類那次踩過同一個坑）。`npm run build` 是 `build-font-css && subset-fonts && astro build`，
跑完整的就會重新子集化。

部署面不受影響——字型產物在 `.gitignore` 裡不進版控，CF Pages 部署時本來就會重跑一次。
這條純粹是為了讓 CI 驗到的東西跟實際部署的一致。

## 規格

### schema

`src/content.config.ts` 的 posts collection 加一欄：

```ts
publishAt: z.coerce.date().optional(),
```

`z.coerce.date()` 而非 `z.date()`：與既有 `date` 欄位一致，讓 YAML 的裸日期字串也能過。

### 判定

```
到期 = draft === true
     && publishAt 存在
     && toTaipeiDay(publishAt) <= toTaipeiDay(now)
```

### 改寫

輸入一篇 md 全文與該檔的 `publishAt`，輸出改寫後的全文。只動 frontmatter 區段（前後兩道
`---` 之間），正文原樣。三個動作：

| 動作 | 前 | 後 |
|------|----|----|
| `date` 換值 | `date: 2026-08-01` | `date: 2026-08-28` |
| 刪 `draft` | `draft: true` | （整行移除） |
| 刪 `publishAt` | `publishAt: 2026-08-28` | （整行移除） |

`date` 的輸出格式跟隨 `publishAt` 在原檔裡的字面值，不做格式正規化——避免把
`2026-08-28` 寫成 `2026-08-28T00:00:00.000Z` 這種與既有 36 篇不一致的形狀。

### CLI

```
node scripts/publish-scheduled.mjs            # dry-run，印今天到期的清單
node scripts/publish-scheduled.mjs --apply    # 真的寫入工作區
node scripts/publish-scheduled.mjs --date <YYYY-MM-DD>   # 覆寫「今天」，供測試
```

### workflow

`.github/workflows/publish-scheduled.yml`

- 觸發：`schedule: '0 0 * * *'`（台北 08:00）＋ `workflow_dispatch`（帶 `dry_run` boolean input）
- `permissions: contents: write`
- `concurrency` 群組同 workflow ＋ ref
- 步驟：checkout → setup-node（`node-version-file: .nvmrc`、`cache: npm`）→ `npm ci`
  → 跑腳本（`dry_run` 為真時不帶 `--apply`）→ `git diff --quiet` 無變更則結束
  → `npm run build` → `npm run verify:seo` → commit ＋ push → 寫 Job Summary

官方 action 一律追大版本 tag（`@v7`），理由見 `seo-pr.yml` 檔頭。

### 防呆

`scripts/verify-seo.mjs` 第 701 行那條「`.md` 變體不應曝光 `draft` 欄位」旁邊平行加一條
`publishAt`。`.md` 變體是白名單輸出（`[...slug].md.ts`），本來就不會漏，但既有的 `draft`
有這道防呆，新增內部欄位不跟上就是留缺口。

## 已知限制

`GITHUB_TOKEN` 推的 commit 不會觸發其他 workflow（GitHub 的迴圈防護）。目前沒有 push
觸發的 workflow，所以不影響；日後若要靠這次 push 連鎖觸發（例如新文章發布後打 webhook
產社群草稿），得改用 PAT 或 deploy key。

## 驗收

- 一篇 `draft: true` ＋ `publishAt` 為昨天的文章，跑 dry-run 會被列出，`--apply` 後
  frontmatter 只有預期的三行變動
- 同一篇的 `publishAt` 改成明天，dry-run 列不出來
- `draft: true` 但沒有 `publishAt` 的檔，任何情況都不被碰
- 翻牌後 `npm run build` ＋ `npm run verify:seo` 全綠，文章出現在 listing 與 sitemap，
  `datePublished` 等於 `publishAt`
- workflow 以 `dry_run: true` 手動跑一次，沒有 commit 產生
