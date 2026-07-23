---
title: "Nginx Cache 設定教學：為 WordPress 網站打造第二道快取防線"
date: 2025-12-17
description: "在 Cloudflare 之外替 WordPress 加上 Nginx 這道第二層快取：說明 Proxy Cache 與 FastCGI Cache 的適用架構與設定範例、後台與登入 Cookie 的排除規則，以及用 X-Cache-Status 驗證命中率的方法。"
category: "devops"
tags: ["Cache", "Nginx", "WordPress"]
cover: "./images/cover.webp"
draft: false
---

## 前言：Cloudflare 之後，為什麼還需要 Nginx Cache？

用 Cloudflare CDN 加速 WordPress 網站已經是標準配備了，但只靠 CDN 其實還不夠穩。

Cloudflare 的快取會過期，也可能因為更新設定而被清空。這時候如果沒有第二層快取，所有流量就會直接打到 WordPress 和資料庫，伺服器瞬間壓力山大。但如果有 Nginx Cache 擋著，即使 Cloudflare 快取失效，那些已經被 Nginx 快取過的頁面還是能秒開。

還有一種更慘的情況，PHP 或資料庫掛掉導致整個網站直接 500 錯誤。但如果 Nginx 設定了 `proxy_cache_use_stale`，它會繼續回傳過期的快取內容，至少訪客還能看到東西，不會只看到一片空白。

簡單說，Nginx Cache 就是 Cloudflare 的備援。兩層快取各司其職，網站才真的穩。

## 快取架構：Nginx 在哪一層？

在開始設定之前，先來了解一下 Nginx Cache 在整個架構中的位置：

```text
使用者請求
    ↓
☁️ Cloudflare Cache (第一層) - 全球 CDN
    ↓ (CF 沒快取時)
🔧 Nginx Cache (第二層) - 伺服器端快取 ← 本文重點
    ↓ (Nginx 沒快取時)
🐘 WordPress/PHP-FPM
    ↓
🗄️ MySQL 資料庫
```

簡單來說：

-   第一層 Cloudflare：在全球各地的機房快取你的內容，訪客可以從最近的節點取得資料
-   第二層 Nginx：在你的伺服器上快取，當 Cloudflare 沒有快取時派上用場
-   後端 WordPress：只有當前兩層都沒有快取時，才需要執行 PHP、查詢資料庫

## Nginx Cache 的核心設定

Nginx 提供兩種主要的快取方式，根據你的架構選擇適合的一種：

### 方式一：Proxy Cache（反向代理快取）

如果你的 Nginx 是作為反向代理，前面擋在 WordPress 前面（例如在 Docker 環境或 Zeabur 這類 PaaS 平台上），就使用 Proxy Cache。

在 `http` 區塊中加入以下設定：

```nginx
http {
    # 定義快取路徑和參數
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m use_temp_path=off;

    server {
        listen 80;
        server_name example.com;

        location / {
            # 啟用快取
            proxy_cache my_cache;

            # 針對不同狀態碼設定快取時間
            proxy_cache_valid 200 60m;
            proxy_cache_valid 404 10m;

            # 當後端出問題時，使用過期的快取
            proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;

            # 背景更新快取（訪客不用等）
            proxy_cache_background_update on;

            # 避免快取穿透（多人同時請求同一個未快取頁面）
            proxy_cache_lock on;

            # 加入快取狀態 header（方便除錯）
            add_header X-Cache-Status $upstream_cache_status;

            # 代理到後端
            proxy_pass http://backend;
        }
    }
}
```

### 參數說明

| 參數 | 說明 |
| --- | --- |
| `proxy_cache_path` | 快取儲存的實體路徑 |
| `levels=1:2` | 目錄層級結構，避免單一目錄檔案過多 |
| `keys_zone=my_cache:10m` | 共享記憶體區域名稱和大小（10MB 約可存 8 萬個快取 key） |
| `max_size=1g` | 快取最大總容量 |
| `inactive=60m` | 60 分鐘內未被存取的快取會被刪除 |
| `proxy_cache_valid` | 針對不同 HTTP 狀態碼設定快取時間 |
| `proxy_cache_use_stale` | 後端故障時，繼續使用過期的快取 |

### 方式二：FastCGI Cache（直接快取 PHP）

如果 Nginx 是直接跟 PHP-FPM 溝通（傳統的 LEMP 架構），則使用 FastCGI Cache：

```nginx
http {
    # 定義 FastCGI 快取路徑
    fastcgi_cache_path /var/cache/nginx/fastcgi levels=1:2 keys_zone=php_cache:10m max_size=1g inactive=60m;

    server {
        location ~ \.php$ {
            fastcgi_cache php_cache;
            fastcgi_cache_valid 200 60m;
            fastcgi_cache_key "$scheme$request_method$host$request_uri";

            add_header X-Cache-Status $upstream_cache_status;

            fastcgi_pass unix:/var/run/php-fpm.sock;
            include fastcgi_params;
        }
    }
}
```

兩種方式的設定邏輯類似，差別只在於快取的對象不同。

## 靜態檔案的瀏覽器快取

除了伺服器端快取，我們也可以透過 Nginx 告訴瀏覽器：「這些靜態檔案你可以存久一點」。

```nginx
# 圖片檔案 - 快取 30 天
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}

# 字型檔案 - 快取 1 年
location ~* \.(woff|woff2|ttf|otf)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

`immutable` 告訴瀏覽器：「這個檔案不會變，在過期之前不用再來問我」，可以減少不必要的條件式請求。

## WordPress 的快取排除設定

這是最關鍵的一步。WordPress 的後台、登入頁面、API 絕對不能被快取，否則會出大問題（例如讓別人看到自己的後台）。

```nginx
# 定義需要跳過快取的 URL
map $request_uri $skip_cache {
    default 0;
    ~*/wp-admin/ 1;
    ~*/wp-login.php 1;
    ~*/wp-json/ 1;
}

# 定義已登入用戶跳過快取
map $http_cookie $skip_cache_cookie {
    default 0;
    ~*wordpress_logged_in 1;
}

location / {
    proxy_cache my_cache;

    # 符合條件就跳過快取
    proxy_cache_bypass $skip_cache $skip_cache_cookie;
    proxy_no_cache $skip_cache $skip_cache_cookie;

    proxy_pass http://backend;
}
```

這裡的邏輯是：

-   訪問 `/wp-admin/`、`/wp-login.php`、`/wp-json/` 時跳過快取
-   Cookie 中包含 `wordpress_logged_in` 時跳過快取（表示已登入）

## 實際範例：WordPress + Zeabur

如果你跟我一樣把 WordPress 部署在 Zeabur 上，以下是我實際使用的配置：

```nginx
http {
    # 定義快取路徑
    proxy_cache_path /var/cache/nginx/wordpress levels=1:2 keys_zone=WORDPRESS:100m max_size=1g inactive=60m use_temp_path=off;

    server {
        listen 80 default_server;
        server_name _;

        # Sitemap 不快取（讓搜尋引擎爬到最新）
        location = /sitemap_index.xml {
            try_files $uri =404;
            default_type application/xml;
            expires 0;
        }

        # WordPress 主站
        location / {
            proxy_cache WORDPRESS;
            proxy_cache_valid 200 10m;
            proxy_cache_valid 404 1m;
            proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
            proxy_cache_background_update on;
            proxy_cache_lock on;

            # 快取狀態 header
            add_header X-Cache-Status $upstream_cache_status;

            proxy_pass http://wordpress.zeabur.internal:80;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }
    }
}
```

幾個重點：

-   快取有效時間設定為 10 分鐘（因為前面有 Cloudflare，這裡不用設太長）
-   Sitemap 設定為不快取，讓搜尋引擎隨時能爬到最新的內容
-   `proxy_set_header X-Forwarded-Proto https` 確保 WordPress 知道實際是 HTTPS 連線

## 如何驗證快取是否生效？

設定完成後，最重要的就是驗證有沒有正常運作。

### 查看 X-Cache-Status Header

```bash
curl -I https://your-site.com/
```

在回應標頭中找到 `X-Cache-Status`，可能的值有：

| 狀態 | 說明 |
| --- | --- |
| `HIT` | 快取命中，從 Nginx 快取回傳 |
| `MISS` | 快取未命中，從後端取得後已快取 |
| `BYPASS` | 被規則跳過，沒有快取 |
| `EXPIRED` | 快取已過期 |
| `STALE` | 使用過期快取（後端故障時） |
| `UPDATING` | 背景正在更新快取 |

### 驗證雙層快取

這是驗證 Nginx Cache 價值的最佳方式：

1.  先正常訪問網站幾次，讓 Cloudflare 和 Nginx 都有快取
2.  到 Cloudflare 清空快取（Caching → Purge Everything）
3.  不要清空 Nginx 快取
4.  立刻訪問網站

```bash
curl -I https://your-site.com/
```

預期結果：

```text
cf-cache-status: MISS      ← Cloudflare 剛被清空
X-Cache-Status: HIT        ← Nginx 還有快取！
```

這就是第二道防線的價值：Cloudflare 快取失效時，Nginx 立刻接手。

### 查看快取檔案數量

```bash
# 查看快取檔案數量
find /var/cache/nginx/wordpress -type f | wc -l

# 查看快取檔案大小
du -sh /var/cache/nginx/wordpress/

# 查看最近 30 分鐘內快取的檔案
find /var/cache/nginx/wordpress -type f -mmin -30 -ls | head
```

## 清除 Nginx 快取

有時候你需要手動清除快取（例如更新了網站內容但不想等快取過期）：

### 方法一：刪除快取目錄

```bash
# 刪除所有快取
rm -rf /var/cache/nginx/*

# 重新載入 Nginx
nginx -s reload
```

### 方法二：使用 Cache Purge 模組（進階）

如果你需要精確清除特定頁面的快取，可以使用 ngx\_cache\_purge 模組：

```nginx
location ~ /purge(/.*) {
    allow 127.0.0.1;
    deny all;
    proxy_cache_purge my_cache "$scheme$request_method$host$1";
}
```

這樣就可以透過訪問 `https://your-site.com/purge/path/to/page` 來清除特定頁面的快取。

## 監控快取效能

設定完成後，建議持續監控快取的命中率，確保設定有達到預期效果。

### 自訂 Log 格式

在 `http` 區塊加入：

```nginx
log_format cache_log '$remote_addr - $upstream_cache_status [$time_local] '
                     '"$request" $status $body_bytes_sent '
                     '"$http_referer" "$http_user_agent"';

server {
    access_log /var/log/nginx/cache_access.log cache_log;
}
```

### 分析快取命中率

```bash
# 統計各種快取狀態的數量
grep -o "HIT\|MISS\|BYPASS" /var/log/nginx/cache_access.log | sort | uniq -c

# 即時監控快取狀態
tail -f /var/log/nginx/cache_access.log | grep --line-buffered "HIT\|MISS"
```

## 目錄權限設定

如果 Nginx 無法寫入快取目錄，快取就不會生效。確保權限設定正確：

```bash
mkdir -p /var/cache/nginx
chown -R nginx:nginx /var/cache/nginx
chmod -R 755 /var/cache/nginx
```

## 與 Cloudflare 搭配的注意事項

當 Cloudflare 在前面時，有幾點需要注意：

1.  大部分請求會被 Cloudflare 攔截，到不了 Nginx 這是好事！代表 Cloudflare 在幫你擋流量。Nginx Cache 主要是處理 CF 沒快取的請求。
2.  兩個快取狀態 Header 不同

-   `cf-cache-status`：Cloudflare 的快取狀態
-   `X-Cache-Status`：Nginx 的快取狀態

1.  快取時間的設定策略 Cloudflare 快取時間可以設長一點（例如 4 小時），Nginx 可以設短一點（例如 10 分鐘），因為 Nginx 只是備援。

## 常見問題 FAQ

**Q1：Nginx Cache 和 Cloudflare Cache 會衝突嗎？**

不會。它們是互補的關係。Cloudflare 處理全球分發，Nginx 處理 Cloudflare 沒快取時的請求。

**Q2：快取時間應該設多長？**

建議 Nginx Cache 設定 10-30 分鐘即可，因為前面有 Cloudflare。如果沒有 CDN，可以設定 1-4 小時。

**Q3：Docker 環境下快取目錄會消失？**

記得把快取目錄掛載為 Volume，避免容器重啟後快取消失。如果你還沒有容器化部署的經驗，可以參考 [Ubuntu 上容器化 Node.js 教學](/nodejs-docker-ubuntu-containerization-tutorial/)。

**Q4：為什麼一直看到 MISS？**

可能原因：  
1\. 快取目錄沒有寫入權限  
2\. 後端回傳了 `Cache-Control: no-cache`  
3\. URL 有查詢字串（每個查詢字串都是不同的快取 key）

**Q5：Sitemap 要不要快取？**

建議不要，讓搜尋引擎能爬到最新的 Sitemap。可以單獨設定 `expires 0`。

## 總結

Nginx Cache 作為 Cloudflare 之後的第二層快取，提供了額外的保護和效能提升：

-   Cloudflare 快取失效時，Nginx 立刻接手
-   後端故障時，繼續提供過期內容
-   降低資料庫和 PHP 的負擔
-   設定一次，長期受益

搭配 [Cloudflare Cache Rules](/cloudflare-cache-rules-wordpress/) 一起使用，就能打造完整的雙層快取架構，讓你的 WordPress 網站達到最佳效能。

## 參考資料與延伸閱讀

### 參考資料

-   [Nginx 官方快取文件](https://docs.nginx.com/nginx/admin-guide/content-cache/content-caching/)
-   [WordPress 效能優化指南](https://developer.wordpress.org/advanced-administration/performance/cache/)

### 延伸閱讀

-   [Zeabur Nginx 反向代理教學：從子網域到子目錄的完整實戰](/zeabur-nginx-subdomain-to-subdirectory/) - 如果你想進一步優化網站架構，可以參考這篇
-   [網站搬家超簡單：WordPress 無痛轉移 Zeabur 完整教學](/wordpress-migrate-to-zeabur/) - 如果你想把 WordPress 搬到 Zeabur 平台
