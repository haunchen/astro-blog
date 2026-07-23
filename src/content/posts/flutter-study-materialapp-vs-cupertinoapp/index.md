---
title: "【 Flutter 學習筆記 】 MaterialApp vs CupertinoApp"
date: 2025-06-23
description: MaterialApp 和 CupertinoApp 是 Flutter 的根 Widget，分別遵循 Google Material Design 與 Apple iOS Human Interface Guidelines。整理兩者的定義、核心作用與常用屬性，並用比較表格說明該怎麼選。
category: "flutter"
tags: ["Flutter"]
cover: "./images/cover.webp"
draft: false
---

## MaterialApp

### 定義

`CupertinoApp` Flutter 應用程式的根部Widget，他提供一整套 Google Material Design 設計規範的基礎架構和行為。可以把它想像成一個「Material Design 應用程式的預建框架和說明書」。

### 核心作用

-   定義應用程式整體外觀和行為：包含了應用程式的基礎主題、導航機制和許多開箱即用的功能。

-   整合 Material Design 元件：它是使用所有 `Material` 前綴的 Widget (如：`Scaffold`, `AppBar`, `ElevatedButton`, `Card` 等) 的必要元件，確保這些子元件可以正確地顯示 Material Design 樣式和行為。

-   提供應用程式級別服務：內建陸行管理、主題數據傳遞等應用程式層級的服務。

### 常用屬性

-   `title` (String)：應用程式在多工管理器中顯示的標題。

-   `home` (Widget)：應用程式啟動時顯示的第一個頁面 Widget。通常是一個Scaffold。

-   `theme` (ThemeData)：應用程式德視覺主題，這裡可以定義整個應用程式的整體顏色、字體、文字樣式、按鈕樣式、卡片陰影等，這些設定將自動應用到應用程式中的所有 Material Widget。

-   `routes` (Map<String, WidgetBuilder>)：用於定義命行路由，允許你透過名稱導航到不同的頁面，不是直接傳遞 Widget 實例。

-   `onGenerateRoute` (RouteFactory)：一個用於動態生成的路由函式，當 `route` 中找不到匹配的命名路由時會被呼叫。

-   `navigatorKey` (GlobalKey<NavigatorState>)：允許在沒有 `BuildContext` 的情況下執行導航操作。

-   `debugShowCheckedModeBanner` (bool)：在開發模式下，是否在右上角顯示 DEBUG 橫幅，預設為true。

-   `localizationsDelegates` 和 `supportedLocales`： 用於處理應用程式的國際化和多語言支持。

## CupertinoApp

### 定義

`CupertinoApp` 也是 Flutter 的根 Widget，但他是提供一套遵守 Apple iOS Human Interface Guidelines (HIG) 設計規範的基礎架構和行為。可以把它想像成一個「iOS 風格應用程式的預建框架和說明書」。

### 核心作用

-   定義應用程式的 iOS 風格外觀和行為： 它設定了應用程式的基礎 iOS 主題、iOS 風格的導航動畫和許多針對 iOS 設計的功能。

-   整合 Cupertino 元件： 它是使用所有 `Cupertino` 前綴的 Widget (如 `CupertinoNavigationBar`, `CupertinoButton`, `CupertinoSlider` 等) 的必要上下文，確保這些元件能正確顯示並擁有 iOS 的樣式和行為。

-   提供應用程式級別服務 (iOS 特化)： 與 `MaterialApp` 類似，也內建路由管理、主題數據傳遞、國際化支持等，但這些服務會更傾向於 iOS 的實現方式。

### 常用屬性

-   `title` (String)： 應用程式在 iOS 多工管理器（應用程式切換器）中顯示的標題。

-   `home` (Widget)： 應用程式啟動時顯示的第一個頁面 Widget。通常會是一個 `Scaffold` 內部包裹著 `Cupertino` 元件。

-   `theme` (CupertinoThemeData)： 應用程式的視覺主題。你可以設定應用程式的 iOS 主色調、文字顏色、字體等，這些設定會應用到應用程式中的所有 Cupertino Widget。

-   `routes` (Map<String, WidgetBuilder>)： 同樣用於定義命名路由，但導航動畫會是 iOS 風格。

-   `onGenerateRoute` (RouteFactory)： 同樣用於動態生成路由。

-   `navigatorKey` (GlobalKey<NavigatorState>)： 允許你在沒有 `BuildContext` 的情況下執行導航操作。

-   `debugShowCheckedModeBanner` (bool)： 同樣控制開發模式下的「DEBUG」橫幅。

-   `localizationsDelegates` 和 `supportedLocales`： 用於處理應用程式的國際化和多語言支持。

## 比較表格

| **特性** | MaterialApp | CupertinoApp |
| --- | --- | --- |
| **風格** | Material Design 風格 | iOS Human Interface Guidelines 風格 |
| **設計哲學** | Google Material Design (物理隱喻、大膽、現在、跨平台) | **Apple iOS Human Interface Guidelines** (簡潔、流暢、半透明、原生 iOS) |
| **平台傾向** | Android (但通常用於跨平台) | iOS |
| **外觀風格** | 預設像 **Android App**，高度可客製化 | 預設像 **原生 iOS App**，較少客製化選項 |
| **主要 UI 元件** | `Scaffold`, `AppBar`, `ElevatedButton`, `Card`, `SnackBar`, `TextField` 等 | `CupertinoNavigationBar`, `CupertinoButton`, `CupertinoSlider`, `CupertinoAlertDialog` 等 |
| **頁面過渡** | 標準的 Material 過渡（例如從底部滑入，或淡入淡出） | **iOS 風格**的過渡（例如從右側滑入，支援邊緣滑動返回） |
| **主題系統** | `ThemeData` (全面且靈活) | `CupertinoThemeData` (較為簡潔) |
| **適用場景** | 創建**跨平台**且具**統一 Material 設計**的應用程式 | 創建**專為 iOS** 設計，追求**原生 iOS 外觀和體驗**的應用程式 |
| **偵錯橫幅** | 有 (`debugShowCheckedModeBanner`) | 有 (`debugShowCheckedModeBanner`) |
| **國際化支援** | 有 (`localizationsDelegates`, `supportedLocales`) | 有 (`localizationsDelegates`, `supportedLocales`) |

## 小結

兩者都是 `WidgetApps` 的具體實現，兩個核心區別在於遵循的設計系統。`MaterialApp` 專注於遵循 Google 的 Material Design，而 `CupertinoApp` 則專注於 Apple 的 iOS Human Interface Guidelines。

如果你剛開始學 Flutter，建議同步搞清楚 [StatefulWidget 與 StatelessWidget 的差異](/flutter-study-writing-statefulwidget-vs-statelesswidget/)，這是另一個核心概念，配合 `MaterialApp` 的狀態管理理解效果更好。確定好應用框架之後，就可以進一步嘗試串接後端服務，像是 [用 Firebase 實作 Google 登入](/flutter-firebase-google-authentication-tutorial/)就是個很好的練手起點。
