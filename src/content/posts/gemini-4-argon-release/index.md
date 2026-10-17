---
title: "Gemini 4 Argon 發布：分數很驚豔，但它不是每一項都贏"
date: 2026-10-01
updated: 2026-10-17
changelog:
  - date: 2026-10-17
    note: "Pro 已能在 agy 使用 Argon，補上長文整理、code review、跨檔案重構實測"
  - date: 2026-10-14
    note: "補上 10 月 13 日開放付費用戶後各方案的可用範圍，以及介紹期價格的截止日"
description: "Gemini 4 Argon 9 月 30 日發布、10 月 13 日開放付費用戶，DeepSWE 77.9% 第一、輸出上限 1M token，終端機操作類 benchmark 仍輸 Opus 5.5 與 GPT-6 Astra。整理官方數字與開放範圍，並實測長文整理、code review、跨檔案重構。"
category: "tech-news"
tags: ["Gemini", "LLM", "AI"]
cover: "./images/cover.webp"
draft: false
---
## 前言：兩週前那個叫 gemini-3.8-flash 的模型

9 月 17 日，LMArena 上冒出一個叫 `gemini-3.8-flash` 的模型。名字看起來只是小改版，但試過的人很快就覺得不對勁：它生 SVG 和 3D 場景的品質高得不像 Flash 等級，有開發者說它 14 分鐘做完一整個作品展示網站，也有人貼出一個 prompt 就生出來的完整互動遊戲。

社群的猜測是，這其實是 Google 還沒發表的旗艦，內部代號 Argon。接著 X 上開始流傳一張成績單，說它的 one-shot 能力和 coding 分數都壓過 OpenAI 的 GPT-6 Astra。

9 月 30 日，Google 正式發布 Gemini 4 Argon，證實了這個代號。

我第一眼看官方 benchmark 表的反應是：這跳得有點多。DeepSWE 直接把第一名拿走，長文推理那幾項更是把其他家甩開一段距離。

不過把 19 項分數全部攤開來看，事情沒有標題那麼單純。它贏的和輸的，剛好分成很清楚的兩堆。這篇就來拆這兩堆，順便對一下流出版和官方版差了多少。

> 先說清楚：前半是整理官方公告和第三方整理的數字，加上我自己的判斷。10 月 16 日起我的 Pro 帳號在 Antigravity CLI 叫得到 Argon，長文整理、code review、跨檔案重構三項實測放在後面「實測：Pro 在 agy 叫得到之後」那節。

## 先講事實：Google 這次發布了什麼

以下以 Google 官方部落格的公告為準，作者是 Google DeepMind 的 Koray Kavukcuoglu。

| 項目 | 內容 |
|------|------|
| 發布日期 | 2026 年 9 月 30 日 |
| 定位 | 新一代 frontier model，主打長流程的軟體工程、企業知識工作（法律、金融）、資安防禦 |
| 輸出上限 | 1M token（前一代是 64K） |
| 輸入 context | 公告沒有寫 |
| 介紹期價格 | 輸入 $2／百萬 token、輸出 $10／百萬 token，到 2026 年 11 月 30 日 |
| 介紹期後 | 12 月 1 日起輸入 $4、輸出 $20 |
| 快取輸入 | 輸入價打 5% 計，介紹期約 $0.10／百萬 token |
| 首波開放對象 | 只有 Fairwind 計畫裡的資安防禦單位 |
| 之後開放順序 | 先給付費 API 客戶與 Google AI Ultra 訂閱者，再擴大到開發者、企業、一般使用者 |

最值得注意的數字是輸出上限：從 64K 一口氣拉到 1M，十幾倍。以前叫模型改一整個專案，常常寫到一半就被截斷，得拆成好幾輪。輸出能到 1M，代表一次吐出整批檔案的修改變得可行。

Google 自己舉的例子也是往這個方向：內部團隊用 Argon 做大型 codebase 遷移，規模從數萬行到 80 萬行以上。

介紹期在發布公告裡沒寫，10 月 13 日開放付費 API 時才講清楚：到 11 月 30 日為止，12 月 1 日起輸入輸出都翻倍。如果你打算拿它跑量，成本要用翻倍後的價格估。

## 它贏在哪：會讀、會規劃

以下數字來自 DataCamp 整理的完整對照表，和官方公告、MarkTechPost 的數字交叉對過，一致。

| Benchmark | 測什麼 | Argon | Opus 5.5 | GPT-6 Astra | Fable 5.1 |
|-----------|--------|-------|----------|-------------|-----------|
| DeepSWE v1.1 | 長流程真實軟體工程 | **77.9%** | 74.2% | 74.1% | 67.4% |
| GraphWalks（256K–1M） | 超長文件推理 | **84.2%** | 66.8% | 71.8% | 65.0% |
| Harvey's Legal Agent | 法律研究與起草 | **19.6%** | 3.8% | 5.4% | 6.7% |
| Vals Finance Agent v2 | 多步驟金融研究 | **65.4%** | 58.6% | 53.5% | 58.9% |
| AutomationBench | 商務流程端到端執行 | **51.3%** | 42.5% | 41.4% | 31.4% |
| LVBench | 長影片理解 | **91.7%** | 83.7% | 87.5% | 79.7% |
| LABBench 2 | 生物實驗研究 | **88.8%** | 73.1% | 85.4% | 68.6% |

這張表我最在意的是 GraphWalks 那一行。256K 到 1M 這個長度區間，其他三家都掉到 72% 以下，Argon 還有 84.2%，差距有 12 到 19 個百分點。

配上 1M 的輸出上限，等於它不只吐得出很長的東西，讀很長的東西時也比較不會漏。

Harvey 那項的絕對分數很低，19.6%，但其他三家都在 7% 以下，等於這個任務對所有模型都很難，只有 Argon 開始做得出一點東西。

DeepSWE 領先 3.7 個百分點，沒有標題講得那麼誇張，但它是這張表裡最接近「實際寫 code」的一項，第一名換人還是有意義。

## 它輸在哪：實際操作終端機

同一份表，換另一半來看：

| Benchmark | 測什麼 | Argon | 最高分 |
|-----------|--------|-------|--------|
| Terminal-bench 4.0 | 在終端機裡完成任務 | 57.4% | Opus 5.5 **66.4%** |
| FrontierSWE v2 | 前沿軟體工程題 | 55.0% | GPT-6 Astra **65.5%** |
| Terminal-Bench Science 0.1 | 科學計算終端機任務 | 57.6% | GPT-6 Astra **68.1%** |
| OSWorld-2.0（offline） | 操作電腦介面 | 69.2% | GPT-6 Astra **72.6%** |
| PostTrainBench | 模型後訓練任務 | 45.3% | Opus 5.5 **49.3%** |

這幾項不是小輸。Terminal-bench 差 9 分，FrontierSWE 和 Terminal-Bench Science 都差 10.5 分。

我自己的讀法是：**Argon 比較會規劃、會讀，但下指令、看結果、再修正這種一來一回的操作，Opus 5.5 和 GPT-6 Astra 還是比較強。** DataCamp 的結論也差不多：「Argon is the better planner and reader, while Astra and Opus 5.5 are still better at driving a terminal.」

這對寫 code 的人很實際。如果你的用法是丟一份大規格書或整個 repo，請它一次規劃、一次產出，Argon 看起來是目前最強的。如果你的用法是 coding agent 在終端機裡跑測試、看錯誤訊息、改、再跑，現有的選擇不一定輸它。

資安那項 CWE-bench v1（修漏洞），Argon 68% 和 GPT-6 Astra 並列第一，Opus 5.5 是 67%，三家其實差不多。

## 流出版 vs 官方版：差了不少

回頭對一下兩週前流出的那份成績單：

| 項目 | 流出版（9 月中） | 官方（9 月 30 日） |
|------|-----------------|-------------------|
| DeepSWE v1.1 | 約 88% | 77.9% |
| OSWorld-2.0 | 86.8% | 69.2% |
| 輸出上限 | 256K | 1M |
| 輸入上限 | 10M | 公告沒寫 |

DeepSWE 差了 10 分，OSWorld 差了 17 分，輸出上限反而是官方比流言大。流出版裡 OSWorld 還贏 GPT-6 Astra，官方數字則是輸的。

流言報導當時就附註過，Google 沒有證實任何數字。現在回頭看，模型身分猜對了，兩項分數都報高了，輸出上限則報低了。

至於那些「一個 prompt 生出完整遊戲」「14 分鐘做完網站」的 one-shot 實測，官方公告沒有對應的 benchmark 可以驗。Vibe Code Bench 是最接近的一項，Argon 91.9%、Opus 5.5 和 Fable 5.1 都是 90.3%，領先但差距很小。所以 one-shot 那些展示我會先當成「有潛力」，等自己跑過再說。

## 為什麼先給資安防禦者

Argon 這次沒有直接開放給大眾，而是先透過 Fairwind 計畫給「受信任的資安防禦者」。公告沒有說明資格怎麼審，只說會收集早期測試者回饋、調整安全防護後，再盡快開放。

會這樣安排，跟它主打的資安能力有關。能修漏洞的模型，反過來就能找漏洞。Google 在公告裡列了五項安全措施：

1. 擋有害請求，但保留正當的雙用途研究
2. 用自動化紅隊和對抗式訓練強化 prompt injection 防護
3. 監看推理過程和行為，必要時中止執行
4. 高風險訓練前，先隔離並封住 sandbox 環境
5. 監測模型內部 activation，抓濫用跡象

公告也提到有參與美國政府自願性的模型發布前審查流程。

Fairwind 這一輪只跑了兩週。

## 10 月 13 日：開放付費用戶

10 月 13 日 Google 開始對付費用戶推送 Argon，Sundar Pichai 在 X 上的說法是：全球付費 API 的開發者與企業、Antigravity 裡的 Ultra 訂閱者、Gemini App 和搜尋裡的 Ultra 與 Pro 訂閱者，從今天開始可以用。

把各家報導對起來，各方案能用到的地方大概是這樣：

| 使用管道 | AI Pro | AI Ultra | 備註 |
|---------|--------|----------|------|
| Gemini App | 可以 | 可以 | Pro 也能在 Canvas 裡請它產 code |
| 搜尋的 AI Mode | 可以 | 可以 | 在「+」選單切換模型 |
| Antigravity 桌面版 | 不行 | 可以 | 符合資格的 Gemini Enterprise 也有 |
| Antigravity CLI | 可以 | 可以 | 開放時只有 Ultra；10 月 16 日我的 Pro 帳號在 agy 1.4.0 已經叫得到 |
| AI Studio | 不行 | 可以 | 依 Ars Technica 的整理 |
| Gemini API | — | — | 付費層級就能用，跟訂閱方案無關；免費層不行 |

Google AI Plus 和免費用戶目前都還用不到，Google 也沒說之後會不會開。Pro 進 Antigravity 這件事 Google 沒有另外公告，我是在 agy 更新到 1.4.0 後發現模型清單多了 Argon。另外推送是分批的，Android Police 的作者是 Pro 訂閱者，寫稿當下 App 裡也還沒出現。

第三方工具已經先接上了：Cursor 宣布可以選 Argon，價格照 API 的 $2／$10 計，它自家的 CursorBench 在預設 effort 下是 52.8%。

> 對一般開發者來說，這段的實際意義是：**想在 coding agent 裡用 Argon，現在有四條路。** 付費 API 自己接（或透過 Cursor 這類工具）、訂 Ultra 用 Antigravity、公司有符合資格的 Gemini Enterprise，或是用 Pro 帳號透過 Antigravity CLI（agy）叫。

## 實測：Pro 在 agy 叫得到之後

10 月 16 日，我的 Pro 帳號在 agy 1.4.0 已經可以選 `gemini-4-argon-low`／`medium`／`high`。原本想等開放再試的兩件事，一是長文件整理，二是一次規劃並產出跨檔案重構，這次都跑了，另外多測一項 code review。

### 長文整理：24 萬 token 內和 Opus 打平

拿一包工作上的產品調研資料，問一組有標準答案的問題，裡面埋了幾題陷阱。對照組是 Opus 5.5，走 Claude Code 自己的 CLI，避免兩邊都受 agy 的限制影響。

| 輸入量 | Argon | Opus 5.5 |
|--------|-------|----------|
| 約 17 萬 token（62 個檔） | 17/17 | 17/17 |
| 約 50 萬 token（216 個檔） | 全對 11、半對 5、錯 2，約 750 秒 | 18/18，約 128 秒 |

17 萬那組打平，陷阱題兩邊都沒上當。寫法不太一樣：Argon 的綜整資訊密度比較高，Opus 的重點排序比較貼近實際要解的問題。

50 萬那組 Argon 輸了，但主因不在模型：agy 在大約 24 萬 token 會自動壓縮前面的內容，細節就是在那裡掉的。所以 GraphWalks 那個 256K–1M 的優勢，透過 agy 驗證不了，要測得直接打 API。成本倒是很漂亮，同一題換算成 API 價，Argon 約 1 美元，Opus 是 3.64 美元。

### Code review：比 Flash 安靜

我維護的 Claude Code 外掛有一套 review 測試：在 diff 裡埋缺陷，算 reviewer 抓到幾成，另外也算它有沒有無中生有。

| 設定 | 抓到比例（三輪合計） |
|------|---------------------|
| Gemini 3.8 Flash high | 70% |
| Argon high | 45% |
| Argon medium | 55% |
| Argon high＋為它重寫的 prompt | 69% |

四組都沒有捏造問題。Argon 的毛病是太快下結論，常常只報一兩條就說可以合併，每題花的思考 token 只有 Flash 的幾分之一。替它改了 prompt 之後追平 Flash，但在另一套專罰誤報的測試裡，它把一個看不出 Node 版本的 CI 設定報成三條「CI 會全掛」的高嚴重度問題。追平而已，還多了新毛病，review 我繼續用 Flash。

### 跨檔案重構：先指出規格寫錯，再一次做完

考題是我做過的一個真實重構：一個內部管理系統的 React 前端，把 700 行頁面裡的編輯視窗抽成獨立元件。issue 寫了驗收條件，既有測試一條都不准改。我當時的實作留著當標準答案，它附的測試當隱藏題。Argon 和 3.8 Flash 各自從重構前的版本開始，拿同一份 issue 做。

Argon 第一輪沒有動手，先回報 issue 和程式碼有四處對不上：issue 指定的元件介面跟它要比照的另外兩頁實際寫法不同、一個 hook 的參數名寫錯、兩個共用函式該放哪、測試怎麼分工。每一點都附了建議，這幾處我當時實作時也撞到、照現況校正過，它的建議跟我最後的做法一致。

把決策補進 issue 後，兩邊都一次做完：

| | Argon | 3.8 Flash |
|---|---|---|
| 耗時 | 約 9 分鐘 | 約 11 分鐘 |
| 頁面行數（我的版本 392 行） | 391 | 395 |
| 既有測試 | 全過 | 全過 |
| 隱藏題 16 條 | 16/16 | 16/16 |
| 自己補的測試 | 19 條 | 14 條 |
| 格式檢查 | 過 | 沒過 |

Flash 是直接拿到補好決策的版本，所以「看出規格寫錯」這點只有 Argon 有機會表現。重構本身兩邊都做得到，差在動手之前。

這跟前面 benchmark 的讀法對得起來：給它一份寫清楚的規格，它會先讀懂、找出矛盾，再一次產出。只有一題，不能當定論，但比我預期的好。

順帶一個坑：Flash 前兩次一個檔都沒改。原因是我的 agy 設定有一支 hook 會提示模型優先用某個 MCP，Flash 照做，headless 模式下 MCP 權限被自動拒絕，整輪什麼都沒產出，exit code 卻是 0。Argon 不理那句提示，所以沒事。如果你也在 agy 設定裡掛了 MCP 提示，用 headless 跑之前要留意。

## 你現在可以做什麼

- 有付費 Gemini API 帳號的話，現在就能接，介紹價到 11 月 30 日
- 預估長期成本時用 12 月起的 $4／$20 來算，不要用 $2／$10
- 只有 Pro 的話，Gemini App 和 agy 都叫得到。長文件整理在 24 萬 token 內品質跟 Opus 差不多，超過就會被 agy 壓縮掉細節
- 規格寫得清楚的重構、遷移，可以交給它一次規劃產出；要它挑 bug 的 code review，先別換
- 如果你主要是用 coding agent 在終端機裡工作，不用急著換，Terminal-bench 的差距擺在那裡

## 結語

Gemini 4 Argon 的分數確實驚豔，長文推理和法律、金融這類知識工作的領先幅度都很明顯。但它不是全面輾壓：要在終端機裡一來一回操作的任務，Opus 5.5 和 GPT-6 Astra 還是領先一截。

自己跑過之後，這個印象沒變，反而更具體：它擅長讀完再規劃，重構前會先抓出規格的矛盾；要它逐行挑錯，它反而太快放行。

所以要不要用它，看你平常怎麼用 AI 寫 code：一次丟大量資料請它規劃產出的，值得試；整天讓 agent 在終端機裡跑的，現在手上的工具先用著就好。

## 參考資料

- [Gemini 4 Argon: our next era of frontier intelligence（Google 官方公告）](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/)
- [Gemini 4 Argon: Benchmarks, Pricing, and Access（DataCamp）](https://www.datacamp.com/blog/gemini-4-argon)
- [Google DeepMind Unveils Gemini 4 Argon with 1M Output Tokens（MarkTechPost）](https://www.marktechpost.com/2026/09/30/google-deepmind-unveils-gemini-4-argon-with-1m-output-tokens-for-coding-knowledge-work-and-cyber-defense/)
- [Gemini 4 Argon in Google Antigravity（Google Antigravity 官方部落格）](https://antigravity.google/blog/gemini-4-argon-in-google-antigravity/)
- [Sundar Pichai 的開放公告（X）](https://x.com/sundarpichai/status/2110038898009407584)
- [Gemini 4 Argon is here（Android Police）](https://www.androidpolice.com/gemini-4-argon-available-pro-ultra-subscribers/)
- [Google Adds Gemini 4 Argon To AI Mode For Pro & Ultra Subscribers（Search Engine Journal）](https://www.searchenginejournal.com/google-gemini-4-argon-ai-mode/592806/)
- [Google rolls out Gemini 4 Argon to paying users（Superpower Daily，整理自 Ars Technica）](https://superpowerdaily.com/posts/google-rolls-out-gemini-4-argon-to-paying-users-with-tighter-limits-for-coding-tools)
- [Leaked Gemini 4 Pro benchmarks show it beating GPT-6 Astra and Claude（TechBriefly）](https://techbriefly.com/2026/09/21/gemini-4-pro-benchmarks-beat-gpt-6-astra-claude/)
