---
title: "Flutter App 在 Android 系統啟動卡死問題：完整除錯與解決指南"
date: 2025-08-02
updated: 2026-11-19
changelog:
  - date: 2026-11-19
    note: "範例改為 flutter_secure_storage 11.x 寫法，補排除備份與升級注意事項"
description: "Flutter App 在 Debug 與 Release 都正常，上架 Google Play 後卻卡在啟動畫面。記錄從 ProGuard、廣告初始化到 Android 備份機制的除錯歷程，最後以 flutter_secure_storage 的 resetOnError 解決。"
category: "flutter"
tags: ["Flutter", "GooglePlay", "Secure"]
cover: "./images/cover.webp"
draft: false
---

## 前言

最近在開發 Flutter App 遇到一個棘手的問題，一個在 Debug 及 Release Mode 測試下都正常，一發布到 Google Play ，手機下載後就遇到卡在啟動畫面無法進入主頁的問題。但是如果先透過手動移除應用程式數據後，就能進入到主頁，一切功能都正常。

經過反覆的測試及除錯，發現主要問題是 Flutter Secure Storage 套件造成。本文將完整記錄除錯過程與解決方案，希望能幫助遇到類似問題的開發者。

> 如果你也在 Flutter App 中串接 Firebase 或 Google 登入，並使用 flutter\_secure\_storage 儲存 token，本文的除錯方法同樣適用。可以參考 [Flutter x Firebase 身份驗證教學](/flutter-firebase-google-authentication-tutorial/)。

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

```xml
# 在 android/app/proguard-rules.pro 中加入
-keep class io.flutter.plugins.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn io.flutter.plugins.**
```

結果：問題依舊存在，排除此假設。

#### 假設二：廣告初始化的 Deadlock

-   懷疑理由：google\_mobile\_ads 套件在初始化時可能導致應用程式凍結。
-   採取行動：

```dart
// 將廣告初始化從 main.dart 移至其他位置
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // 移除 MobileAds.instance.initialize();
  runApp(MyApp());
}
```

> `MyApp()` 通常是 [MaterialApp 或 CupertinoApp](/flutter-study-materialapp-vs-cupertinoapp/) 的根 Widget，若初始化在根 Widget 建構期間就卡死，整個 UI 樹都無法掛載。

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

```dart
// 當執行到這行程式碼時
final apiKey = await _storage.read(key: 'api_key');
// 原生層嘗試讀取加密數據，但無法正常解密，進入無限等待
```

## 最終解決方案

### 核心代碼修復

> 本文寫於 2025 年 8 月，當時用的是 flutter_secure_storage 9.x。下面的範例已改成 11.x 的寫法：v10 起 `resetOnError` 預設就是 `true`，v11 移除了 `encryptedSharedPreferences` 參數，iOS 的列舉在 6.0 起叫 `KeychainAccessibility`。原本的寫法在 v11 會編譯失敗。

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  static const FlutterSecureStorage _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      resetOnError: true, // 關鍵設定：遇到錯誤時重置（v10 起已是預設值）
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
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

`resetOnError` 是讓 App 不要卡死，代價是還原回來的資料會被清掉，使用者要重新登入。要從源頭避免，得讓 Android 不要備份這些加密資料。

### 從源頭避免：別讓 Android 備份加密資料

flutter_secure_storage 官方 README 的建議是關閉自動備份，或把它用的 SharedPreferences 排除在備份之外。最簡單的做法是在 `android/app/src/main/AndroidManifest.xml` 加上：

```xml
<application
  android:allowBackup="false"
  ...>
</application>
```

要注意的是，[Android 官方文件](https://developer.android.com/identity/data/autobackup)寫明 target API 31（Android 12）以上時，部分廠商的裝置上 `allowBackup="false"` 只會關掉雲端備份，換手機時的裝置對裝置轉移不一定跟著關。要兩種都擋，得用 `dataExtractionRules` 把 `cloud-backup` 和 `device-transfer` 兩區都排除，設定方式見同一份文件。

### 從舊版升級要注意

-   還在 v10 以前的版本，先升到 v10 讓資料自動遷移，再升 v11。v11 的 CHANGELOG 寫明，直接跨過 v10 的話，用舊演算法存的資料升級後就讀不到了
-   v11 把 Android 的 `minSdk` 拉到 24，並移除了 `sharedPreferencesName`，改用 `storageNamespace`
-   v11.1.0 起有 `checkUpgradeStatus()`，可以檢查是不是因為直接跨大版升級而遺失了資料

## 預防措施與最佳實踐

### 1\. 強化錯誤處理

```dart
class RobustSecureStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      resetOnError: true,
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

```dart
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

-   Flutter 框架與原生平台的整合（包含 [StatefulWidget 的生命週期](/flutter-study-writing-statefulwidget-vs-statelesswidget/)管理）
-   Google Play 的應用程式優化機制
-   不同 Android 版本的相容性
-   安全儲存系統的底層實作

關鍵學習點：

1.  系統性的除錯方法比隨機嘗試更有效
2.  多方測試的每個結果都可能是關鍵線索
3.  複雜問題往往是多個因素的交互作用
4.  預防性的錯誤處理比事後修復更重要

對於 Flutter 開發者，我強烈建議在使用 flutter\_secure\_storage 時，不要把 `resetOnError` 關掉（v10 起它預設就是 `true`），並且把加密資料排除在 Android 備份之外。前者讓 App 不會卡死，後者才是從源頭避免問題。

## 參考資料與延伸閱讀

-   [Flutter Secure Storage 官方文檔](https://pub.dev/packages/flutter_secure_storage)
-   [Flutter Secure Storage CHANGELOG](https://pub.dev/packages/flutter_secure_storage/changelog)
-   [Android 自動備份文件（含 dataExtractionRules）](https://developer.android.com/identity/data/autobackup)
-   [Android KeyStore 系統文檔](https://developer.android.com/training/articles/keystore)
-   [Google Play App Bundle 指南](https://developer.android.com/guide/app-bundle)
