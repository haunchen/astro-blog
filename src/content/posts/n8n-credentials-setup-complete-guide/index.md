---
title: "n8n 憑證設定懶人包：常用服務快速導覽（持續更新）"
date: 2025-07-04
description: "彙整 Telegram、WordPress、Notion、Discord、Line、Google 等常用服務在 n8n 的憑證設定重點，標示每個服務的設定複雜度與預估花費時間，點出容易漏掉的授權步驟，並附上各篇完整教學的連結，方便你快速找到需要的設定方式。"
category: "n8n"
tags: ["Automation", "n8n", "憑證"]
cover: "./images/cover.webp"
draft: false
---

## 前言：我設定過的憑證經驗談

從開始用 n8n 到現在，我設定過的憑證大概有十幾種。其中 Google 系列讓我印象最深刻，第一次設定花了 30-40 分鐘，結果還忘記發布應用程式，一週後憑證就過期了，又要重新授權一次。

相比之下，Telegram Bot 大概 5 分鐘就搞定，馬上就能收到通知，超有成就感。

這篇文章整理了我實際用過的 n8n 憑證設定方法。如果你是第一次設定某個服務，可以點擊「完整教學」看詳細步驟；如果你只是想快速回顧重點，看這篇的摘要就夠了。

## 常用服務憑證設定快速導覽

### 1\. Telegram Bot - 最推薦新手第一個設定

**複雜度：** ⭐（超簡單）｜**設定時間：** 約 5 分鐘

Telegram Bot 是我最推薦新手第一個設定的服務。設定超簡單，而且馬上就能看到效果，對建立信心很有幫助。

**設定重點：**

-   在 Telegram 找 `@BotFather` 建立 Bot，取得 Token
-   用 `@userinfobot` 取得你的 Chat ID
-   在 n8n 填入 Token 就完成了

**完整教學：** [n8n x Telegram Bot 打造專屬通知機器人：從 BotFather 到互動指令完全教學](/n8n-telegram-bot-notification-tutorial/)

### 2\. WordPress - 部落格作者必備

**複雜度：** ⭐（簡單）｜**設定時間：** 約 5 分鐘

**設定重點：**

-   在 WordPress 後台「個人資料」頁面建立「應用程式密碼」
-   注意：要用應用程式密碼，不是你的登入密碼
-   WordPress URL 結尾不要加斜線

**完整教學：** [n8n x WordPress 整合指南：API 設定、媒體上傳、自動發文全攻略](/n8n-wordpress-api-integration-guide/)

### 3\. Notion - 別忘了授權頁面

**複雜度：** ⭐⭐⭐（中等）｜**設定時間：** 約 10 分鐘

Notion 設定不難，但有一個步驟超容易漏掉。我第一次設定時，填完密鑰卻一直連不上，回頭檢查教學才發現漏掉「授權 Integration 存取頁面」這步。

**設定重點：**

-   在 [Notion Integrations](https://www.notion.so/profile/integrations) 建立 Integration
-   取得 Internal Integration Secret
-   **最容易漏掉：到你的頁面或 Database 授權給這個 Integration**

**完整教學：** [n8n 整合 Notion 完整教學：API 設定、Database 操作、實戰案例](/n8n-notion-api-integration-tutorial/)

### 4\. Discord Bot - 步驟多但照著做就行

**複雜度：** ⭐⭐⭐⭐（較複雜）｜**設定時間：** 約 20-30 分鐘

Discord 的 OAuth 設定步驟比較多，需要在 Developer Portal 設定好幾個參數。不過照著教學一步一步做，應該不會有太大問題。

**設定重點：**

-   在 [Discord Developer Portal](https://discord.com/developers/applications) 建立應用程式
-   需要取得三組金鑰：Client ID、Client Secret、Bot Token
-   記得設定 Bot 權限和 OAuth2 Redirects

> 如果你只是想發通知，用 Discord Webhook 會更簡單，不需要設定 Bot。

**完整教學：** [n8n x Discord Bot 社群自動化完全指南：OAuth 設定到發送訊息實戰](/n8n-discord-bot-setup-tutorial/)

### 5\. Line Bot - 台灣市場必備

**複雜度：** ⭐⭐⭐⭐（較複雜）｜**設定時間：** 約 15-20 分鐘

Line 在台灣的使用率超高，從個人生活到公司內部溝通都離不開它。n8n 整合 Line 需要用社群節點 `Line Messaging`，設定上比 Telegram 複雜一些，但對台灣用戶來說實用性很高。

**設定重點：**

-   先建立 Line 官方帳號並啟用 Messaging API
-   在 n8n 安裝社群節點 `Line Messaging`
-   設定 Webhook URL 讓 Line 知道要把訊息傳到哪
-   注意：免費方案每月只能主動推送 200 則訊息

**完整教學：** [n8n 整合 Line 完整教學：Line Bot 設定、憑證設定、節點介紹](/n8n-line-api-integration-tutorial/)

### 6\. Canva - 台灣少見的教學

**複雜度：** ⭐⭐⭐⭐（較複雜）｜**設定時間：** 約 20-25 分鐘

Canva 憑證設定在台灣幾乎沒人寫過教學，我當初花了不少時間研究國外資源才搞懂。最特別的是 Canva 要求必須先開啟 MFA（多重要素驗證）才能使用 API。

**設定重點：**

-   先開啟 Canva 帳號的 MFA（用 Google Authenticator）
-   在 Canva Developers 建立 Integration
-   使用 OAuth 2.0 PKCE 模式
-   重定向網址要完全一致，少一個 `/` 都會報錯

**完整教學：** [n8n 整合 Canva 完整教學：OAuth 2.0 憑證設定與測試指南](/n8n-canva-oauth-setup/)

### 7\. Google 系列 - 最複雜但最常用

**複雜度：** ⭐⭐⭐⭐⭐（最複雜）｜**設定時間：** 約 30-40 分鐘

Google 憑證設定是我覺得 n8n 裡面最麻煩的。在 Google Cloud Console 裡面很容易迷路，而且要設定的東西很多：建立專案、開啟 API、設定 OAuth 同意畫面、建立憑證、設定權限…

我自己第一次設定時，權限沒開對，又忘記發布應用程式，結果一週後憑證就過期，要重新授權。

**設定重點：**

-   在 [Google Cloud Console](https://console.cloud.google.com/) 建立專案
-   開啟需要的 API（Gmail、Sheets、Drive 等）
-   設定 OAuth 同意畫面和資料存取權
-   **重要：記得發布應用程式，不然每週都要重新授權**

**完整教學：** [n8n 憑證設定指南：串接 Google Cloud 服務 新手也能輕鬆上手](/n8n-google-credentials-setup-guide/)

### 8\. Instagram / Facebook - 最耗時的設定

**複雜度：** ⭐⭐⭐⭐⭐（非常複雜）｜**設定時間：** 約 40-60 分鐘

Instagram API 的設定步驟最多，而且 Token 只有 60 天效期，需要定期更新或設定自動延長機制。

**設定重點：**

-   需要建立 Meta 應用程式
-   Instagram 帳號必須是「專業帳號」且綁定 Facebook 粉絲專頁
-   短期 Token 要轉換成長期 Token（60 天）

**完整教學：** [n8n 自動化 上傳 Instagram 完全指南：從取得 Token 到排程發文](/n8n-instagram-access-token/)

## 服務比較表

| 服務 | 複雜度 | 設定時間 | 特色 |
| --- | --- | --- | --- |
| Telegram Bot | ⭐ | 5 分鐘 | 最簡單，新手首選 |
| WordPress | ⭐ | 5 分鐘 | 用應用程式密碼 |
| Notion | ⭐⭐⭐ | 10 分鐘 | 別忘了授權頁面 |
| Line Bot | ⭐⭐⭐⭐ | 15-20 分鐘 | 台灣必備，需裝社群節點 |
| Discord Bot | ⭐⭐⭐⭐ | 20-30 分鐘 | 步驟多，照做就行 |
| Canva | ⭐⭐⭐⭐ | 20-25 分鐘 | 要先開 MFA |
| Google 系列 | ⭐⭐⭐⭐⭐ | 30-40 分鐘 | 記得發布應用程式 |
| Instagram | ⭐⭐⭐⭐⭐ | 40-60 分鐘 | Token 60 天過期 |

## 我的建議

很多人問我新手應該先設定哪個服務，老實說這要看你的需求。

如果你想快速體驗 n8n 的威力，**從 Telegram 開始**是不錯的選擇，設定簡單又能馬上看到效果。

我自己目前最常用的是 **Discord 通知**和 **Google 系列**（主要是 Google Sheet），這兩個在我的自動化流程中出現頻率最高。

不管你選哪個開始，記得一個原則：**設定完就馬上測試**。確認連線成功再繼續下一步，不然到時候出問題很難除錯。

## 相關文章

### 憑證設定教學系列

-   [n8n 整合 Notion 完整教學：API 設定、Database 操作、實戰案例](/n8n-notion-api-integration-tutorial/)
-   [n8n x WordPress 整合指南：API 設定、媒體上傳、自動發文全攻略](/n8n-wordpress-api-integration-guide/)
-   [n8n x Telegram Bot 打造專屬通知機器人：從 BotFather 到互動指令完全教學](/n8n-telegram-bot-notification-tutorial/)
-   [n8n x Discord Bot 社群自動化完全指南：OAuth 設定到發送訊息實戰](/n8n-discord-bot-setup-tutorial/)
-   [n8n 整合 Line 完整教學：Line Bot 設定、憑證設定、節點介紹](/n8n-line-api-integration-tutorial/)
-   [n8n 整合 Canva 完整教學：OAuth 2.0 憑證設定與測試指南](/n8n-canva-oauth-setup/)
-   [n8n 憑證設定指南：串接 Google Cloud 服務 新手也能輕鬆上手](/n8n-google-credentials-setup-guide/)
-   [n8n 自動化 上傳 Instagram 完全指南：從取得 Token 到排程發文](/n8n-instagram-access-token/)

### 實戰應用案例

-   [不用再當搬運工！n8n 助你實現 Notion 無縫轉移 WordPress 的完美攻略](/n8n-notion-wordpress-publish-automation/)
-   [Line Bot × Canva 封面圖一鍵上傳 WordPress 系統](/n8n-template-line-bot-upload-system/)
-   [n8n 模板分享 - 探店心願助手](/n8n-template-store-wish-list/)

這篇文章會持續更新，之後會加入 Meta 系列、GitHub 等服務的設定教學。如果你在設定過程中遇到問題，歡迎到 [Threads](https://www.threads.com/@frankchen.tw) 或 [Instagram](https://www.instagram.com/frankchen.tw/) 找我。
