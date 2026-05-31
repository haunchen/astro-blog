---
title: "【 Flutter 學習筆記 】 StatefulWidget vs StatelessWidget"
date: 2025-06-19
description: "在 Flutter 中，StatefulWidget 是需要管理內部狀態的動態頁面，適用於用戶交互和數據變化；而 StatelessWidget 是靜態頁面，不會改變內容。這兩者在性能和使用場景上有所不同，應根據需求合理選擇。"
category: "flutter"
tags: ["Flutter"]
cover: "./images/cover.webp"
draft: false
---

簡單來說，在 [Flutter](https://flutter.dev/) 中，StatefulWidget 是動態的頁面，StatelessWidget 就如同字面上的的意思，是個靜態的頁面。

## StatefulWidget

### 定義

一個需要管理內部狀態的 Widget，表示內部的某個屬性需要在生命週期內根據使用者的響應做改變。

### 使用時機

-   內部需要動態變化：Widget 顯示的內容或屬性需要根據應用程式內部運行狀態或使用者想要改變。

-   需要使用者響應變化：Widget 需要響應用戶得點擊、拖動、輸入等操作更新UI。

-   需要管理內部數據：Widget 需要組織一些隨著時間變化的數據。

-   需要生命週期方法：Widget 需要針對不同生命週期階段 (初始化、更新、銷毀) 執行特定的方法。

### 常見範例

-   `Checkbox`：使用者點擊，其選中狀態會改變。

-   `TextField`： 使用者輸入文本後，其顯示內容會改變。

-   `Switch`：使用者切換開關後，其開關狀態改變。

-   `ListView.builder`：顯示一個可滾動的列表，當數據改變時，列表內容會更新。

-   `AlertDialog`：彈出對話匡，根據使用者響應來執行特定操作。

## StatelessWidget

### 定義

一個不需要管理內部狀態的Widget，當被創建的當下，其內容就已經被定義好不會被改變。

### 使用時機

-   內容是靜態的：Widget 內容創建後不會改變。

-   數據是外部傳入的：Widget 只會根據父 Widget 傳入的數據來渲染UI，本身並不會維護這個數據的變化。

-   不響應使用者交互而改變自身：Widget 不會因為使用者點擊、輸入等操作而改變自身狀態。

### 常見範例

-   `Text`：顯示一段文字，文字創建後不會改建。

-   `Icon`：顯示一個圖標，圖標類型和顏色在創建後不會改變。

-   `Image`：顯示一張圖片，圖片來源和顯示方式在創建後不會被改變。

-   `Padding`：只給予子Widget 增加填充空間。

-   `AppBar`：通常在被創建後其內容不會被改變。

## StatefulWidget vs StatelessWidget 比較表格

特性

StatefulWidget

StatelessWidget

狀態管理

具有內部可辨狀態

無內部狀態

變更性

內容可以根據狀態變化而改變

一旦創建內容無法改變

重建

狀態改變時可透過 `setState` 重建

僅當服Widget 重建時才會重建

性能

相對較重，需要管理狀態

輕量級，性能開銷小

使用場景

動態內容、使用者交互、數據變化

靜態內容、純展示

## 小結

這兩個 Widget 很像，但使用的時機不一樣，對於系統的性能使用也不同，在專寫功能時需注意盡量使用 `StatelessWidget` 來渲染UI，適當地將狀態管理細化，降低系統負擔。
