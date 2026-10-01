---
title: "Gemini 4 Argon 發布：分數很驚豔，但它不是每一項都贏"
date: 2026-10-01
description: "Gemini 4 Argon 在 2026 年 9 月 30 日發布，DeepSWE 77.9% 拿下第一、輸出上限拉到 1M token，但終端機操作類 benchmark 仍輸 Opus 5.5 與 GPT-6 Astra。整理官方數字、價格、開放時程，以及和流出版的落差。"
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

> 先說清楚：Argon 目前只開放給特定資安單位，我還沒用到。這篇是整理官方公告和第三方整理的數字，加上我自己的判斷，沒有實測。

## 先講事實：Google 這次發布了什麼

以下以 Google 官方部落格的公告為準，作者是 Google DeepMind 的 Koray Kavukcuoglu。

| 項目 | 內容 |
|------|------|
| 發布日期 | 2026 年 9 月 30 日 |
| 定位 | 新一代 frontier model，主打長流程的軟體工程、企業知識工作（法律、金融）、資安防禦 |
| 輸出上限 | 1M token（前一代是 64K） |
| 輸入 context | 公告沒有寫 |
| 介紹期價格 | 輸入 $2／百萬 token、輸出 $10／百萬 token |
| 介紹期後 | 輸入 $4、輸出 $20 |
| 快取輸入 | 輸入價打 5% 計，介紹期約 $0.10／百萬 token |
| 目前開放對象 | 只有 Fairwind 計畫裡的資安防禦單位 |
| 之後開放順序 | 先給付費 API 客戶與 Google AI Ultra 訂閱者，再擴大到開發者、企業、一般使用者 |

最值得注意的數字是輸出上限：從 64K 一口氣拉到 1M，十幾倍。以前叫模型改一整個專案，常常寫到一半就被截斷，得拆成好幾輪。輸出能到 1M，代表一次吐出整批檔案的修改變得可行。

Google 自己舉的例子也是往這個方向：內部團隊用 Argon 做大型 codebase 遷移，規模從數萬行到 80 萬行以上。

介紹期多長，公告沒有寫。如果你打算拿它跑量，要預期價格之後會翻倍。

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

> 對一般開發者來說，這段的實際意義是：**現在還用不到。** 要等 Fairwind 這一輪結束，付費 API 和 AI Ultra 才會開，時間點公告沒有給。

## 你現在可以做什麼

現在能做的不多：

- 有付費 Gemini API 帳號的話，留意 Google AI Studio 和公告更新，開放順序上你排在前面
- 預估成本時用介紹期後的 $4／$20 來算，不要用 $2／$10，介紹期多長沒人知道
- 如果你主要是用 coding agent 在終端機裡工作，不用急著換，Terminal-bench 的差距擺在那裡

我自己會等它在 agy（Google 的 Antigravity CLI）裡開放之後才去測。到時候我最想試的有兩件事：一是丟一整份長文件請它整理，看 GraphWalks 那個長文優勢在實際使用時有沒有感；二是請它一次規劃並產出一個跨檔案的重構，看 1M 輸出是不是真的能一輪做完。

## 結語

Gemini 4 Argon 的分數確實驚豔，長文推理和法律、金融這類知識工作的領先幅度都很明顯。但它不是全面輾壓：要在終端機裡一來一回操作的任務，Opus 5.5 和 GPT-6 Astra 還是領先一截。

所以要不要等它，看你平常怎麼用 AI 寫 code：一次丟大量資料請它規劃產出的，值得等；整天讓 agent 在終端機裡跑的，現在手上的工具先用著就好。

## 參考資料

- [Gemini 4 Argon: our next era of frontier intelligence（Google 官方公告）](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/)
- [Gemini 4 Argon: Benchmarks, Pricing, and Access（DataCamp）](https://www.datacamp.com/blog/gemini-4-argon)
- [Google DeepMind Unveils Gemini 4 Argon with 1M Output Tokens（MarkTechPost）](https://www.marktechpost.com/2026/09/30/google-deepmind-unveils-gemini-4-argon-with-1m-output-tokens-for-coding-knowledge-work-and-cyber-defense/)
- [Leaked Gemini 4 Pro benchmarks show it beating GPT-6 Astra and Claude（TechBriefly）](https://techbriefly.com/2026/09/21/gemini-4-pro-benchmarks-beat-gpt-6-astra-claude/)
