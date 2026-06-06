---
title: "私密資料不上傳！將 v0.dev 生成的 Web 應用程式部署到你自己的 Ubuntu 伺服器"
date: 2025-06-14
description: "本篇文章介紹了如何在自己的伺服器上執行由 Vercel 的 v0.dev 生成的 Web 應用，特別針對 Ubuntu 系統提供安裝 Node.js 和 pnpm 的步驟，並指導用戶如何啟動本地開發及正式環境伺服器，以便私有資料不需上傳到網絡平台。"
category: "devops"
tags: ["Node.js", "Ubuntu", "v0.dev", "Vercel"]
cover: "./images/cover.webp"
draft: false
---

## 前言

現在有很多 AI 相關的應用如雨後春筍般出現，[Vercel](https://vercel.com) 旗下的 [v0.dev](https://v0.dev/) 提供一個線上的環境供使用者可以透過自然語言設計自己的 Web 應用，且在建立完成後還可以一鍵發佈，縮減產品上線步驟。

接下來我將一步步帶你如何在自己的伺服器上執行 v0.dev 生成的 Web 應用程式，本篇教學以 `Ubuntu` 系統為主。

## 系統環境

系統環境：

-   Ubuntu: 22.04 LTS
-   Node.js: 22.16
-   pnpm: 10.12.1

## 安裝必要套件

-   Node.js 套件

建議使用 NodeSource 提供的安裝腳本，確保安裝最新版本 Node.js。

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - 
sudo apt-get install -y nodejs
```

-   pnpm 套件

```bash
curl -L https://get.pnpm.io/install.sh | sh -
```

安裝完成後，需要重新開啟終端機，或執行 `source ~/.bashrc` 更新 PATH 環境變數。

## 安裝專案依賴

-   導航到專案資料夾

```bash
cd your/project/folder
```

-   安裝專案依賴

```bash
pnpm install
```

-   執行開發伺服器

依賴安裝完成後，您可以啟動開發伺服器。通常 Next.js 專案會使用 `pnpm dev` 命令。

```bash
pnpm dev
```

這將啟動一個本地開發伺服器，可以直接在瀏覽器輸入 `htpp://localhost:3000` 前往。

-   執行正式環境

```bash
pnpm build
pnpm start
```

這將啟動一個本地正式伺服器，可以直接在瀏覽器輸入 `htpp://localhost:3000` 前往。

## 小結

以上就是針對將 [v0.dev](https://v0.dev/) 產生的專案部署到自己的伺服器上，如果不想把私人的資料上傳到網站的話可以使用此方法。

伺服器跑起來後，通常還需要幾個後續步驟：申請免費 SSL 憑證可以參考 [使用 Certbot 建立免費 SSL 憑證](/create-free-ssl-domain-certificates-using-certbot/)；若專案規模增大、部署複雜度上升，也可以考慮 [將 Node.js 專案容器化（Docker）](/nodejs-docker-ubuntu-containerization-tutorial/) 來管理環境；在 Next.js 應用上線後如果遇到記憶體用量偏高，可以參考 [geoip-lite 記憶體優化實戰](/nextjs-geoip-memory-optimization/) 的降級策略思路。
