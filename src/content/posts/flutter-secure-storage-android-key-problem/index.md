---
title: "Flutter App 在 Android 系統啟動卡死問題：完整除錯與解決指南"
date: 2025-08-02
description: "本文探討了Flutter應用在Google Play上啟動卡死的問題，經測試發現是flutter_secure_storage套件導致的。通過重設錯誤選項來解決此問題，並強調了錯誤處理及多方測試的重要性，以避免類似過程中的潛在問題。"
category: "flutter"
tags: ["Flutter", "GooglePlay", "Secure"]
cover: "./images/cover.webp"
draft: false
---

## 前言

最近在開發 Flutter App 遇到一個棘手的問題，一個在 Debug 及 Release Mode 測試下都正常，一發布到 Google Play ，手機下載後就遇到卡在啟動畫面無法進入主頁的問題。但是如果先透過手動移除應用程式數據後，就能進入到主頁，一切功能都正常。

經過反覆的測試及除錯，發現主要問題是 Flutter Secure Storage 套件造成。本文將完整記錄除錯過程與解決方案，希望能幫助遇到類似問題的開發者。

## 問題現象

-   **環境**：Samsung S23 Ultra，Android 15
-   **觸發條件**：從 Google Play 下載安裝
-   **現象**：App 卡在啟動畫面，完全無回應
-   **關鍵線索**：手動清除 App 數據後可正常啟動

## 除錯歷程：從假設到真相

### 階段一：常見問題排除

#### 假設一：ProGuard 程式碼混淆問題

-   懷疑理由：Release 版本特有問題，懷疑 Google Play 的 R8 壓縮工具移除了必要的原生程式碼。
-   採取行動：

\# 在 android/app/proguard-rules.pro 中加入
-keep class io.flutter.plugins.\*\* { \*; }
-keep class com.google.android.gms.\*\* { \*; }
-dontwarn io.flutter.plugins.\*\*

```
# 在 android/app/proguard-rules.pro 中加入
-keep class io.flutter.plugins.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn io.flutter.plugins.**
```

結果：問題依舊存在，排除此假設。

#### 假設二：廣告初始化的 Deadlock

-   懷疑理由：google\_mobile\_ads 套件在初始化時可能導致應用程式凍結。
-   採取行動：

// 將廣告初始化從 main.dart 移至其他位置
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // 移除 MobileAds.instance.initialize();
  runApp(MyApp());
}

```
// 將廣告初始化從 main.dart 移至其他位置
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // 移除 MobileAds.instance.initialize();
  runApp(MyApp());
}
```

結果：問題持續，證明不是廣告套件造成。

### 階段二：關鍵線索分析

根據反覆測試得到幾個關鍵問題點：

1.  「手動清除數據才成功」 → 問題與儲存狀態相關
2.  「另一隻手機沒問題」 → 特定裝置相容性問題
3.  「下載完就有數據產生」 → 手機備份還原機制問題

### 階段三：根本原因追蹤

flutter\_secure\_storage 套件會依賴 Android KeyStore 將數據加密過後儲存，所以合理懷疑可能是 Android 系統的備份機制造成的問題。

系統在備份時可能會包含以下數據：

-   SharedPreferences 數據
-   被加密過的數據
-   內部存儲檔案

但是不會備份加密用的 Key，導致重新安裝 App 時還原的加密數據無法被解密，造成 App Deadlock。

// 當執行到這行程式碼時
final apiKey = await \_storage.read(key: 'api\_key');
// 原生層嘗試讀取加密數據，但無法正常解密，進入無限等待

```
// 當執行到這行程式碼時
final apiKey = await _storage.read(key: 'api_key');
// 原生層嘗試讀取加密數據，但無法正常解密，進入無限等待
```

## 最終解決方案

### 核心代碼修復

import 'package:flutter\_secure\_storage/flutter\_secure\_storage.dart';

class SecureStorageService {
  static const FlutterSecureStorage \_storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      resetOnError: true, // 關鍵設定：遇到錯誤時重置
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: IOSAccessibility.first\_unlock\_this\_device,
    ),
  );
  
  static Future<String?> getApiKey() async {
    try {
      return await \_storage.read(key: 'api\_key');
    } catch (e) {
      // 額外的錯誤處理
      print('SecureStorage error: $e');
      return null;
    }
  }
}

```
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  static const FlutterSecureStorage _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      resetOnError: true, // 關鍵設定：遇到錯誤時重置
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: IOSAccessibility.first_unlock_this_device,
    ),
  );
  
  static Future<String?> getApiKey() async {
    try {
      return await _storage.read(key: 'api_key');
    } catch (e) {
      // 額外的錯誤處理
      print('SecureStorage error: $e');
      return null;
    }
  }
}
```

### 解決方案說明

`AndroidOptions(resetOnError: true)` 是官方提供的「逃生艙口」，它的作用是：

-   當原生層讀取數據遇到無法處理的錯誤時，不進入死鎖狀態
-   自動刪除所有損壞的數據
-   重新初始化儲存系統

## 預防措施與最佳實踐

### 1\. 強化錯誤處理

class RobustSecureStorage {
  static const \_storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      resetOnError: true,
      encryptedSharedPreferences: true,
    ),
  );
  
  static Future<String?> safeRead(String key) async {
    try {
      return await \_storage.read(key: key);
    } on PlatformException catch (e) {
      if (e.code == 'UserCancel') {
        return null;
      }
      // 記錄錯誤並重試
      await \_storage.deleteAll();
      return null;
    }
  }
}

```
class RobustSecureStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      resetOnError: true,
      encryptedSharedPreferences: true,
    ),
  );
  
  static Future<String?> safeRead(String key) async {
    try {
      return await _storage.read(key: key);
    } on PlatformException catch (e) {
      if (e.code == 'UserCancel') {
        return null;
      }
      // 記錄錯誤並重試
      await _storage.deleteAll();
      return null;
    }
  }
}
```

### 2\. 測試策略

-   在多種 Android 版本上測試
-   使用不同的安裝方式（Google Play、APK）
-   模擬數據損壞情況

### 3\. 監控與日誌

void main() async {
  FlutterError.onError = (FlutterErrorDetails details) {
    // 記錄 flutter\_secure\_storage 相關錯誤
    if (details.toString().contains('flutter\_secure\_storage')) {
      print('SecureStorage Error: ${details.exception}');
    }
  };
}

```
void main() async {
  FlutterError.onError = (FlutterErrorDetails details) {
    // 記錄 flutter_secure_storage 相關錯誤
    if (details.toString().contains('flutter_secure_storage')) {
      print('SecureStorage Error: ${details.exception}');
    }
  };
}
```

## 結論

這個問題的解決過程體現了 App 開發的複雜性。看起來簡單的啟動卡死問題，實際上牽涉了：

-   Flutter 框架與原生平台的整合
-   Google Play 的應用程式優化機制
-   不同 Android 版本的相容性
-   安全儲存系統的底層實作

關鍵學習點：

1.  系統性的除錯方法比隨機嘗試更有效
2.  多方測試的每個結果都可能是關鍵線索
3.  複雜問題往往是多個因素的交互作用
4.  預防性的錯誤處理比事後修復更重要

對於 Flutter 開發者，我強烈建議在使用 flutter\_secure\_storage 時，總是加入 `resetOnError: true` 選項，這個簡單的設定可以避免許多潛在的生產環境問題。

**參考資源：**

-   [Flutter Secure Storage 官方文檔](https://pub.dev/packages/flutter_secure_storage)
-   [Android KeyStore 系統文檔](https://developer.android.com/training/articles/keystore)
-   [Google Play App Bundle 指南](https://developer.android.com/guide/app-bundle)
