---
title: "Threads 資料匯出教學 - 完整圖文步驟指南"
date: 2025-12-31
updated: 2026-11-14
changelog:
  - date: 2026-11-14
    note: "回顧年份改為 2026，日期範圍改建議用自訂"
description: "從 Instagram 帳號管理中心匯出 Threads 資料的完整圖文步驟：選擇自訂資料與日期範圍、格式選 JSON、設定影像畫質後開始匯出，再把下載的 ZIP 壓縮檔上傳到 Threads Wrapped 產生年度回顧統計圖，全程約 5 分鐘。"
category: "tools"
tags: ["threads", "教學", "資料匯出"]
cover: "./images/cover.webp"
draft: false
---

想要回顧你在 Threads 上的 2026 年嗎？在使用 [Threads Wrapped 年度回顧](https://threads-wrapped.frankchen.tw/) 之前，你需要先從 Instagram 匯出你的 Threads 資料。這篇教學將帶你一步步完成資料匯出，整個過程大約只需要 5 分鐘。

Threads Wrapped 最後有互動效果，為了獲得最佳的操作體驗，建議使用電腦進行操作。

## 第一步：前往帳號管理中心

1.  開啟 Instagram，並到你的個人頁面，點擊右上角「三」
2.  點擊「帳號管理中心」
3.  點擊「你的資訊和權限」
4.  選擇你要輸出的帳號

![在 Instagram 個人頁面點擊三條線選單，依序進入帳號管理中心與你的資訊和權限頁面](./images/instagram-account-center-navigation.webp)

## 第二步：前往匯出資料頁面

5.  點擊「匯出你的資訊」
6.  點擊「建立匯出資訊」
7.  選擇要匯出的帳號
8.  選擇「匯出到裝置」

![帳號管理中心點擊匯出你的資訊、建立匯出資訊，並選擇帳號與匯出到裝置的操作畫面](./images/export-info-page-settings.webp)

## 第三步：設定匯出資料的內容

9.  **自訂資料**：選擇「Threads」
10.  **日期範圍**：建議選「自訂」，設定 2026/1/1～2026/12/31。如果是 12 月中就匯出，結束日設成當天即可
11.  **格式**：選擇「JSON」

選單裡也有「去年」之類的預設選項，但新版介面的選項名稱和涵蓋的期間我還沒確認，用自訂日期最不會出錯，實際以你看到的畫面為準。

![自訂資料選擇 Threads、日期範圍設定 2025 年、格式選擇 JSON 的三步驟設定畫面（截圖為 2025 年版介面）](./images/threads-date-format-selection.webp)

## 第四步：匯出 Threads 資料

12.  **影像畫質**選擇「較低品質」（也可以使用預設的中等畫質）
13.  都設定好後就能按下「開始匯出」
14.  輸入 Instagram 密碼
15.  輸入完密碼後，畫面即會出現開始匯出的畫面，匯出完成後平台會寄信通知。（匯出的時間長度與你的資料量有關）

![選擇較低影像畫質、輸入 Instagram 密碼並按下開始匯出的操作畫面](./images/image-quality-password-export-start.webp)

## 第五步：開始回顧你的 Threads

等到平台通知匯出完成後，即可前往剛剛的頁面下載匯出的壓縮檔

16.  點擊「Download」下載壓縮檔
17.  前往 [Threads Wrapped](https://threads-wrapped.frankchen.tw/)，點擊中間的上傳區塊
18.  點擊上傳 ZIP 檔案
19.  選擇你剛剛下載的壓縮檔，開始你的 Threads 回顧之旅吧！

![點擊 Download 下載壓縮檔後，前往 Threads Wrapped 點擊上傳區塊選取 ZIP 檔的操作步驟](./images/download-and-upload-to-threads-wrapped.webp)

別忘了最後可以下載統計圖，分享到你的 Threads 或 Instagram 限時動態！

![Threads Wrapped 產生的 2025 年度回顧統計圖，顯示發文數、互動數等數據（截圖為 2025 年版介面）](./images/threads-wrapped-annual-stats-result.webp)

## 常見問題

### Threads 資料匯出需要多久時間？

匯出時間取決於你的資料量。一般來說，發文數量較少的帳號約需 5-10 分鐘，發文量大的帳號可能需要數小時。Meta 會在匯出完成後寄送通知信。

### 匯出的資料會包含哪些內容？

匯出的 JSON 檔案會包含你的 Threads 貼文內容、發布時間、互動數據等資訊。Threads Wrapped 會分析這些資料，產生你的年度回顧統計。

### 為什麼要選擇 JSON 格式？

Threads Wrapped 需要讀取結構化的資料格式，JSON 是程式可以直接解析的格式。如果選擇 HTML 格式，將無法正確分析你的資料。

### 我的資料安全嗎？

Threads Wrapped 完全在你的瀏覽器本地執行，你的資料不會上傳到任何伺服器。所有分析都在你的電腦上完成，確保隱私安全。此專案完全開源，你可以在 [GitHub](https://github.com/haunchen/threads-wrapped) 查看完整程式碼。

## 關於 Threads Wrapped

Threads Wrapped 是一個開源專案，讓你可以回顧自己在 Threads 上的一整年。如果你喜歡這個專案，歡迎到 [GitHub](https://github.com/haunchen/threads-wrapped) 給個 Star 支持一下！

