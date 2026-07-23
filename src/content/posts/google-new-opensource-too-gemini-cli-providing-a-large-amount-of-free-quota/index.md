---
title: "Google 推出全新開源工具 Gemini CLI 提供大量免費額度"
date: 2025-06-26
description: "Google 推出了免費的 Gemini CLI 工具，提供安裝教學及多種指令選項。用戶需安裝 Node.js 18 以上版本，並可選用多種登入方法。工具包括對話管理、API 設定、主題變更等功能，使用額度為每分鐘 60 次，每天 1000 次。"
category: "tools"
tags: ["AI", "Gemini"]
cover: "./images/cover.webp"
draft: false
---

Google 推出了免費的 Gemini CLI 工具，看來 Claude Code 遇到對手了。安裝教學，指令列表。

## 安裝

[官方 Github](https://github.com/google-gemini/gemini-cli)

### 先決條件

確保電腦已安裝 [Node.js 18](https://nodejs.org/en/download) 或是更高版本。

### 執行 CLI 安裝

-   於隔離環淨執行 (意味著不會安裝在電腦上)

```bash
npx https://github.com/google-gemini/gemini-cli
```

-   直接安裝在電腦上，爾後只要在 terminal 視窗輸入 `gemini` 即可啟動 Gemini CLI

```bash
npm install -g @google/gemini-cli
gemini
```

### 登入驗證

這邊有三個選項可以選擇：

-   Login with Google: 透過你的 Google 帳戶直接登入

-   Gemini API Key: 需前往 [Google AI Studio](https://aistudio.google.com) 申請 API Key

-   Vertex AI: 如果你有開通 Google Cloud 上的 [Vertex AI](https://cloud.google.com/vertex-ai) 服務的話也可以使用

![Gemini CLI 登入驗證畫面，提供 Login with Google、Gemini API Key、Vertex AI 三種選項](./images/login-auth-options.webp)

登入後，即可看到操作畫面

![Gemini CLI 登入後的主操作介面](./images/main-interface-after-login.webp)

## Gemini CLI 指令

### /help

列出所有指令表

### /docs

透過瀏覽器開啟操作說明文件

![執行 /docs 指令後自動在瀏覽器開啟 Gemini CLI 官方說明文件](./images/docs-command-browser-open.webp)

### /chat

管理對話歷史記錄

用法：

```bash
/chat <list|save|resume> [tag]
```

-   list：列出已儲存的對話紀錄

-   save：儲存當前對話紀錄

-   resume：透過 tag 調用歷史對話紀錄

### /stats

檢查 Gemini CLI 會話統計資料

![/stats 指令顯示的 Gemini CLI 會話統計資料，包含 token 用量與請求次數](./images/stats-session-usage.webp)

### /compress

壓縮 Gemini CLI 對話的上下文，減少 token 使用量

![/compress 指令執行後的上下文壓縮結果畫面](./images/compress-context-window.webp)

### /mcp

列出已設定的 MCP 伺服器和工具

官方提供的設定方法：[Github](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md)

### /tools

列出可用的 Gemini CLI 工具

![/tools 指令列出所有可用的 Gemini CLI 內建工具清單](./images/tools-list.webp)

### /theme

更改 Gemini CLI 的主題

![/theme 指令的主題選擇介面，可切換不同配色風格](./images/theme-selection.webp)

### /auth

更改 Gemini CLI 身份驗證方法

![/auth 指令的身份驗證方法切換畫面](./images/auth-method-change.webp)

### /editor

設定外部編輯器預設選項

![/editor 指令的外部編輯器設定畫面](./images/editor-settings.webp)

### /bug

使用 Gemini CLI 若有遇到任何Bug，可以透過此命令進行回報

![/bug 指令的 Bug 回報介面](./images/bug-report-command.webp)

### /about

顯示 Gemini CLI 版本資訊

![/about 指令顯示 Gemini CLI 版本資訊畫面](./images/about-version-info.webp)

### /clear

清除 Gemini CLI 畫面和對話歷史記錄

### /quit

退出 Gemini CLI

## Gemini CLI 使用額度

根據官方文件，一分鐘可調用 60 次模型，一天可調用 1000 次模型

這對於一班使用者來說額度絕對夠用，而且還是使用最新的 `gemini-2.5-pro` 模型

免費使用不知道會持續多久，大家快點把握機會試試看吧～～

---

對 AI CLI 工具有興趣的話，也可以看看這幾篇：

-   [從 0 到 1 打造 n8n AI 技能包：讓 Claude 掌握 500+ 個自動化節點的開源專案實戰](/n8n-skills-claude-ai-skill-pack-tutorial/)
-   [n8n-skills 技術解密 (1)：打造可擴展的四層式資料處理 Pipeline](/n8n-skills-four-layer-pipeline-architecture/)
