---
title: "Markdown 排版測試：所有元素的完整展示"
date: 2026-03-25
description: "測試所有 Markdown 元素在部落格中的呈現效果，包含標題、列表、程式碼、表格、圖片等。"
category: "tools"
tags: ["markdown", "測試", "排版"]
cover: "./images/cover.png"
draft: true
---

## 基本文字排版

這是一個段落，用來測試基本的文字排版。段落中包含**粗體文字**、*斜體文字*、以及[超連結](https://example.com)。也可以使用 `inline code` 來標示程式碼片段。

### 列表展示

以下是無序列表：

- 第一個項目
- 第二個項目
  - 巢狀項目 A
  - 巢狀項目 B
- 第三個項目

以下是有序列表：

1. 安裝相依套件
2. 設定環境變數
3. 啟動開發伺服器

#### 引用區塊

> 好的工具不會妨礙你的思考，而是讓你更專注於真正重要的事情。
>
> — 某位工程師

---

## 程式碼區塊

JavaScript 範例：

```javascript
function greet(name) {
  const message = `Hello, ${name}!`;
  console.log(message);
  return message;
}

greet('World');
```

Python 範例：

```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

for i in range(10):
    print(fibonacci(i))
```

Bash 範例：

```bash
#!/bin/bash
echo "Building project..."
npm run build
echo "Deploy complete!"
```

---

## 表格

| 工具 | 用途 | 推薦程度 |
|------|------|----------|
| Astro | 靜態網站產生器 | 極高 |
| Tailwind CSS | Utility-first CSS 框架 | 極高 |
| Cloudflare Pages | 靜態網站部署 | 高 |

---

## 圖片

![測試用封面圖片](./images/cover.png)

---

以上涵蓋了部落格中常見的 Markdown 元素，可用來驗證排版樣式是否正確呈現。
