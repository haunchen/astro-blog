# squirrelscan Audit Report

**URL:** http://localhost:4321  
**Date:** 2026-07-23T00:41:06.450Z  
**Pages:** 40  
**Version:** 0.0.79

## Health Score

| Category | Score |
|----------|-------|
| **Overall** | **48/100 (F)** |
| **SEO** | **50/100** |
| **Performance** | **43/100** |
| **Security** | **30/100** |
| **Agents** | **47/100** |
| Security | 20/100 |
| Images | 44/100 |
| Accessibility | 75/100 |
| Structured Data | 43/100 |
| Performance | 43/100 |
| Crawlability | 47/100 |
| Core SEO | 60/100 |
| Content | 56/100 |
| Agent Experience | 47/100 |
| URL Structure | 99/100 |
| E-E-A-T | 91/100 |
| Links | 94/100 |
| Internationalization | 100/100 |
| Site Integrity | 100/100 |
| Legal Compliance | 100/100 |
| Local SEO | 100/100 |
| Mobile | 100/100 |
| Social Media | 100/100 |

## Summary

- **Passed:** 4379
- **Warnings:** 453
- **Failed:** 152
- **SEO:** 50/100
- **Performance:** 43/100
- **Security:** 30/100
- **Agents:** 47/100

---

## Issues

### SEO

*109 error(s), 213 warning(s)*

#### Crawlability

*1 error(s), 40 warning(s)*

##### Sitemap Domain **[ERROR]**

`crawl/sitemap-domain`

> Checks that all sitemap URLs belong to the expected domain

**Solution:**

All URLs in your sitemap should point to pages on your own domain. Cross-domain URLs in sitemaps are a configuration error - search engines will ignore URLs that don't match the sitemap's domain. Remove external URLs from your sitemap or fix the domain in URLs if they're incorrectly formatted.

| Check | Status | Message |
|-------|--------|---------|
| sitemap-domain | X fail | 96 URL(s) point to different domain(s) |

<details><summary><strong>sitemap-domain:</strong> 48 page(s) affected</summary>

- [/](https://frankchen.tw/)
- [/about/](https://frankchen.tw/about/)
- [/articles/](https://frankchen.tw/articles/)
- [/category/](https://frankchen.tw/category/)
- [/category/devops/](https://frankchen.tw/category/devops/)
- [/category/flutter/](https://frankchen.tw/category/flutter/)
- [/category/n8n/](https://frankchen.tw/category/n8n/)
- [/category/raspberry-pi/](https://frankchen.tw/category/raspberry-pi/)
- [/category/tools/](https://frankchen.tw/category/tools/)
- [/cloudflare-cache-rules-wordpress/](https://frankchen.tw/cloudflare-cache-rules-wordpress/)
- [/contact-frank/](https://frankchen.tw/contact-frank/)
- [/create-free-ssl-domain-certificates-using-certbot/](https://frankchen.tw/create-free-ssl-domain-certificates-using-certbot/)
- [/flutter-firebase-google-authentication-tutorial/](https://frankchen.tw/flutter-firebase-google-authentication-tutorial/)
- [/flutter-secure-storage-android-key-problem/](https://frankchen.tw/flutter-secure-storage-android-key-problem/)
- [/flutter-study-materialapp-vs-cupertinoapp/](https://frankchen.tw/flutter-study-materialapp-vs-cupertinoapp/)
- [/flutter-study-writing-statefulwidget-vs-statelesswidget/](https://frankchen.tw/flutter-study-writing-statefulwidget-vs-statelesswidget/)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota/](https://frankchen.tw/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota/)
- [/n8n-canva-oauth-setup/](https://frankchen.tw/n8n-canva-oauth-setup/)
- [/n8n-credentials-setup-complete-guide/](https://frankchen.tw/n8n-credentials-setup-complete-guide/)
- [/n8n-data-table-csv-export-import/](https://frankchen.tw/n8n-data-table-csv-export-import/)
- [/n8n-discord-bot-setup-tutorial/](https://frankchen.tw/n8n-discord-bot-setup-tutorial/)
- [/n8n-google-credentials-setup-guide/](https://frankchen.tw/n8n-google-credentials-setup-guide/)
- [/n8n-instagram-access-token/](https://frankchen.tw/n8n-instagram-access-token/)
- [/n8n-line-api-integration-tutorial/](https://frankchen.tw/n8n-line-api-integration-tutorial/)
- [/n8n-line-discord-telegram-bot-comparison/](https://frankchen.tw/n8n-line-discord-telegram-bot-comparison/)
- [/n8n-n8nmanager-introduction/](https://frankchen.tw/n8n-n8nmanager-introduction/)
- [/n8n-notion-api-integration-tutorial/](https://frankchen.tw/n8n-notion-api-integration-tutorial/)
- [/n8n-notion-wordpress-publish-automation/](https://frankchen.tw/n8n-notion-wordpress-publish-automation/)
- [/n8n-resources/](https://frankchen.tw/n8n-resources/)
- [/n8n-skills-claude-ai-skill-pack-tutorial/](https://frankchen.tw/n8n-skills-claude-ai-skill-pack-tutorial/)
- [/n8n-skills-four-layer-pipeline-architecture/](https://frankchen.tw/n8n-skills-four-layer-pipeline-architecture/)
- [/n8n-telegram-bot-notification-tutorial/](https://frankchen.tw/n8n-telegram-bot-notification-tutorial/)
- [/n8n-template-line-bot-upload-system/](https://frankchen.tw/n8n-template-line-bot-upload-system/)
- [/n8n-template-store-wish-list/](https://frankchen.tw/n8n-template-store-wish-list/)
- [/n8n-wordpress-api-integration-guide/](https://frankchen.tw/n8n-wordpress-api-integration-guide/)
- [/nextjs-geoip-memory-optimization/](https://frankchen.tw/nextjs-geoip-memory-optimization/)
- [/nfs-version-nfs4-nfs3-io-blocking/](https://frankchen.tw/nfs-version-nfs4-nfs3-io-blocking/)
- [/nginx-cache-wordpress/](https://frankchen.tw/nginx-cache-wordpress/)
- [/nodejs-docker-ubuntu-containerization-tutorial/](https://frankchen.tw/nodejs-docker-ubuntu-containerization-tutorial/)
- [/privacy-policy/](https://frankchen.tw/privacy-policy/)
- [/raspberry-pi-gpio-high-frequency-noise/](https://frankchen.tw/raspberry-pi-gpio-high-frequency-noise/)
- [/raspberry-pi-gpio-software-debounce-guide/](https://frankchen.tw/raspberry-pi-gpio-software-debounce-guide/)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide/](https://frankchen.tw/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide/)
- [/tag/](https://frankchen.tw/tag/)
- [/threads-data-export-tutorial/](https://frankchen.tw/threads-data-export-tutorial/)
- [/vercel-v0-dev-ubuntu-deploy-web-app/](https://frankchen.tw/vercel-v0-dev-ubuntu-deploy-web-app/)
- [/wordpress-migrate-to-zeabur/](https://frankchen.tw/wordpress-migrate-to-zeabur/)
- [/zeabur-nginx-subdomain-to-subdirectory/](https://frankchen.tw/zeabur-nginx-subdomain-to-subdirectory/)

</details>

---

##### Canonical Chain **[WARN]**

`crawl/canonical-chain`

> Checks for redirect chains on canonical URLs

**Solution:**

Canonical URLs should point directly to the final destination, not through redirects. Redirect chains waste crawl budget and dilute link equity. If your canonical URL redirects, update it to point to the final URL. Check that canonical URLs use the preferred protocol (https) and www/non-www version. Self-referencing canonicals should match the page URL exactly.

| Check | Status | Message |
|-------|--------|---------|
| page-redirect-chain | ! warn | Page redirects before content is served |

<details><summary><strong>page-redirect-chain:</strong> 78 page(s) affected</summary>

- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)
- [/about/](http://localhost:4321/about/)
- [/articles/](http://localhost:4321/articles/)
- [/category/devops/](http://localhost:4321/category/devops/)
- [/category/flutter/](http://localhost:4321/category/flutter/)
- [/category/n8n/](http://localhost:4321/category/n8n/)
- [/category/raspberry-pi/](http://localhost:4321/category/raspberry-pi/)
- [/category/tools/](http://localhost:4321/category/tools/)
- [/cloudflare-cache-rules-wordpress/](http://localhost:4321/cloudflare-cache-rules-wordpress/)
- [/contact-frank/](http://localhost:4321/contact-frank/)
- [/flutter-secure-storage-android-key-problem/](http://localhost:4321/flutter-secure-storage-android-key-problem/)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota/](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota/)
- [/n8n-canva-oauth-setup/](http://localhost:4321/n8n-canva-oauth-setup/)
- [/n8n-credentials-setup-complete-guide/](http://localhost:4321/n8n-credentials-setup-complete-guide/)
- [/n8n-data-table-csv-export-import/](http://localhost:4321/n8n-data-table-csv-export-import/)
- [/n8n-discord-bot-setup-tutorial/](http://localhost:4321/n8n-discord-bot-setup-tutorial/)
- [/n8n-google-credentials-setup-guide/](http://localhost:4321/n8n-google-credentials-setup-guide/)
- [/n8n-instagram-access-token/](http://localhost:4321/n8n-instagram-access-token/)
- [/n8n-line-api-integration-tutorial/](http://localhost:4321/n8n-line-api-integration-tutorial/)
- [/n8n-line-discord-telegram-bot-comparison/](http://localhost:4321/n8n-line-discord-telegram-bot-comparison/)
- [/n8n-notion-api-integration-tutorial/](http://localhost:4321/n8n-notion-api-integration-tutorial/)
- [/n8n-notion-wordpress-publish-automation/](http://localhost:4321/n8n-notion-wordpress-publish-automation/)
- [/n8n-resources/](http://localhost:4321/n8n-resources/)
- [/n8n-skills-claude-ai-skill-pack-tutorial/](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial/)
- [/n8n-skills-four-layer-pipeline-architecture/](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture/)
- [/n8n-telegram-bot-notification-tutorial/](http://localhost:4321/n8n-telegram-bot-notification-tutorial/)
- [/n8n-template-line-bot-upload-system/](http://localhost:4321/n8n-template-line-bot-upload-system/)
- [/n8n-template-store-wish-list/](http://localhost:4321/n8n-template-store-wish-list/)
- [/n8n-wordpress-api-integration-guide/](http://localhost:4321/n8n-wordpress-api-integration-guide/)
- [/nextjs-geoip-memory-optimization/](http://localhost:4321/nextjs-geoip-memory-optimization/)
- [/nfs-version-nfs4-nfs3-io-blocking/](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking/)
- [/nginx-cache-wordpress/](http://localhost:4321/nginx-cache-wordpress/)
- [/privacy-policy/](http://localhost:4321/privacy-policy/)
- [/raspberry-pi-gpio-high-frequency-noise/](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise/)
- [/raspberry-pi-gpio-software-debounce-guide/](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide/)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide/](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide/)
- [/tag/%E6%A8%A1%E6%9D%BF/](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF/)
- [/threads-data-export-tutorial/](http://localhost:4321/threads-data-export-tutorial/)
- [/wordpress-migrate-to-zeabur/](http://localhost:4321/wordpress-migrate-to-zeabur/)
- [/zeabur-nginx-subdomain-to-subdirectory/](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory/)

</details>

---

##### Sitemap Coverage **[WARN]**

`crawl/sitemap-coverage`

> Checks for indexable pages that are not in the sitemap

**Solution:**

Your sitemap should include all pages you want search engines to index. Pages that are crawlable and indexable (no noindex, not blocked by robots.txt) should generally be in your sitemap. Missing pages may not be discovered or indexed efficiently. Use a sitemap generator that automatically includes all indexable pages, or manually add important pages.

| Check | Status | Message |
|-------|--------|---------|
| sitemap-coverage | ! warn | 40 indexable page(s) not in sitemap (100%) |

<details><summary><strong>sitemap-coverage:</strong> 40 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

---

#### Accessibility

*40 error(s), 13 warning(s)*

##### Label Content Name Mismatch **[ERROR]**

`a11y/label-content-name-mismatch`

> Checks that visible label text is part of accessible name

**Solution:**

For controls with visible labels, the accessible name should contain the visible text. Voice control users say what they see - if the accessible name doesn't include the visible label, voice commands won't work. Example: A button showing 'Search' should not have aria-label='Find products'.

| Check | Status | Message |
|-------|--------|---------|
| label-content-name-mismatch | X fail | 1 element(s) where visible text doesn't match accessible name |

<details><summary><strong>label-content-name-mismatch:</strong> 40 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

<details><summary><strong>label-content-name-mismatch:</strong> 1 item(s)</summary>

- button: visible="▾" vs aria-label="展開文章子選單"

</details>

---

##### Identical Links Same Purpose **[WARN]**

`a11y/identical-links-same-purpose`

> Checks that links with identical text go to the same destination

**Solution:**

Links with the same visible text should go to the same URL. When identical link text leads to different destinations, it confuses screen reader users who navigate by listing links. Make link text unique or more descriptive to differentiate destinations.

| Check | Status | Message |
|-------|--------|---------|
| identical-links-same-purpose | ! warn | N link text(s) lead to different destinations |

<details><summary><strong>identical-links-same-purpose:</strong> 4 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)

</details>

<details><summary><strong>identical-links-same-purpose:</strong> 7 item(s)</summary>

- "github →" → 2 different URLs
- "n8n" → 2 different URLs
- "threads →" → 5 different URLs
- "website →" → 3 different URLs
- "youtube 頻道 →" → 3 different URLs
- "查看全部 →" → 2 different URLs
- "模板 →" → 3 different URLs

</details>

---

##### Redundant Image Alt **[WARN]**

`a11y/image-redundant-alt`

> Checks that image alt text is not redundant with surrounding text

**Solution:**

Image alt text should not start with 'image of', 'photo of', 'picture of', etc. Screen readers already announce that it's an image. Alt text should describe the content or function, not state the obvious. Also avoid duplicating adjacent text in the alt.

| Check | Status | Message |
|-------|--------|---------|
| image-redundant-alt | ! warn | 1 image(s) with redundant alt text |

<details><summary><strong>image-redundant-alt:</strong> 1 page(s) affected</summary>

- [/n8n-resources](http://localhost:4321/n8n-resources)

</details>

<details><summary><strong>image-redundant-alt:</strong> 1 item(s)</summary>

- alt="Darrell" matches filename

</details>

---

##### Table Duplicate Name **[WARN]**

`a11y/table-duplicate-name`

> Checks that data tables have unique accessible names

**Solution:**

When a page has multiple data tables, each should have a unique accessible name to help users distinguish between them. Use <caption>, aria-label, or aria-labelledby with unique text for each table.

| Check | Status | Message |
|-------|--------|---------|
| tables-without-names | ! warn | N table(s) without accessible names |

<details><summary><strong>tables-without-names:</strong> 8 page(s) affected</summary>

- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)

</details>

---

#### URL Structure

*0 error(s), 3 warning(s)*

##### URL Length *[Recommendation]*

`url/length`

> Checks URL length for optimal SEO

**Solution:**

Shorter URLs are easier to read, share, and may rank better. Keep URLs under 75 characters when possible. URLs over 100 characters can be truncated in search results and social shares. Remove unnecessary parameters, stop words, and path segments. Use descriptive but concise slugs. Long URLs often indicate poor site architecture.

| Check | Status | Message |
|-------|--------|---------|
| url-length | ! warn | URL is 114 characters (over 100) |

<details><summary><strong>url-length:</strong> 1 page(s) affected</summary>

- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)

</details>

---

##### URL Lowercase **[WARN]**

`url/lowercase`

> Checks that URLs are lowercase

**Solution:**

URLs should be lowercase to prevent duplicate content issues. Most servers treat /Page and /page as different URLs, creating duplicates. Always use lowercase URLs and redirect uppercase variants. Configure your server or CMS to auto-lowercase URLs. This also improves URL consistency and readability.

| Check | Status | Message |
|-------|--------|---------|
| url-lowercase | ! warn | URL contains uppercase characters |

<details><summary><strong>url-lowercase:</strong> 1 page(s) affected</summary>

- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)

</details>

---

##### URL Special Characters **[WARN]**

`url/special-chars`

> Checks for problematic special characters in URL path

**Solution:**

Avoid special characters in URL paths. Characters like %, &, #, ?, = have special meanings and can cause issues. Spaces should be avoided (they become %20). Use only lowercase letters, numbers, and hyphens. Special characters can break links when copied, cause encoding issues, and look unprofessional. URL-encode if unavoidable.

| Check | Status | Message |
|-------|--------|---------|
| url-special-chars | ! warn | URL path contains problematic characters |

<details><summary><strong>url-special-chars:</strong> 1 page(s) affected</summary>

- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)

</details>

<details><summary><strong>url-special-chars:</strong> 1 item(s)</summary>

- non-ASCII characters

</details>

---

#### Core SEO

*0 error(s), 46 warning(s)*

##### Meta Title **[WARN]**

`core/meta-title`

> Validates page title presence and length

**Solution:**

Every page needs a unique, descriptive title tag between 30-75 characters. Titles appear in browser tabs, search results, and social shares. Write titles that accurately describe the page content while including your primary keyword near the beginning. If your title is too short, add more descriptive context. If too long, prioritize the most important information first and trim secondary details. Avoid keyword stuffing or duplicate titles across pages.

| Check | Status | Message |
|-------|--------|---------|
| meta-title | ! warn | Title too short |

<details><summary><strong>meta-title:</strong> 23 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/about/](http://localhost:4321/about/)
- [/articles/](http://localhost:4321/articles/)
- [/category/devops/](http://localhost:4321/category/devops/)
- [/category/flutter/](http://localhost:4321/category/flutter/)
- [/category/n8n/](http://localhost:4321/category/n8n/)
- [/category/raspberry-pi/](http://localhost:4321/category/raspberry-pi/)
- [/category/tools/](http://localhost:4321/category/tools/)
- [/contact-frank/](http://localhost:4321/contact-frank/)
- [/n8n-resources/](http://localhost:4321/n8n-resources/)
- [/privacy-policy/](http://localhost:4321/privacy-policy/)
- [/tag/%E6%A8%A1%E6%9D%BF/](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF/)

</details>

---

##### Meta Description **[WARN]**

`core/meta-description`

> Validates meta description presence and length

**Solution:**

Meta descriptions should be 120-160 characters and provide a compelling summary of the page. While not a direct ranking factor, good descriptions improve click-through rates from search results. Write unique descriptions for each page that accurately preview the content. Include a call-to-action when appropriate. If missing, search engines will auto-generate snippets which may not represent your page optimally.

| Check | Status | Message |
|-------|--------|---------|
| meta-description | ! warn | Description too short |

<details><summary><strong>meta-description:</strong> 67 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)
- [/about/](http://localhost:4321/about/)
- [/articles/](http://localhost:4321/articles/)
- [/category/devops/](http://localhost:4321/category/devops/)
- [/category/flutter/](http://localhost:4321/category/flutter/)
- [/category/n8n/](http://localhost:4321/category/n8n/)
- [/category/raspberry-pi/](http://localhost:4321/category/raspberry-pi/)
- [/category/tools/](http://localhost:4321/category/tools/)
- [/cloudflare-cache-rules-wordpress/](http://localhost:4321/cloudflare-cache-rules-wordpress/)
- [/contact-frank/](http://localhost:4321/contact-frank/)
- [/flutter-secure-storage-android-key-problem/](http://localhost:4321/flutter-secure-storage-android-key-problem/)
- [/n8n-canva-oauth-setup/](http://localhost:4321/n8n-canva-oauth-setup/)
- [/n8n-credentials-setup-complete-guide/](http://localhost:4321/n8n-credentials-setup-complete-guide/)
- [/n8n-data-table-csv-export-import/](http://localhost:4321/n8n-data-table-csv-export-import/)
- [/n8n-discord-bot-setup-tutorial/](http://localhost:4321/n8n-discord-bot-setup-tutorial/)
- [/n8n-notion-api-integration-tutorial/](http://localhost:4321/n8n-notion-api-integration-tutorial/)
- [/n8n-notion-wordpress-publish-automation/](http://localhost:4321/n8n-notion-wordpress-publish-automation/)
- [/n8n-resources/](http://localhost:4321/n8n-resources/)
- [/n8n-skills-claude-ai-skill-pack-tutorial/](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial/)
- [/n8n-skills-four-layer-pipeline-architecture/](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture/)
- [/n8n-telegram-bot-notification-tutorial/](http://localhost:4321/n8n-telegram-bot-notification-tutorial/)
- [/n8n-template-line-bot-upload-system/](http://localhost:4321/n8n-template-line-bot-upload-system/)
- [/n8n-template-store-wish-list/](http://localhost:4321/n8n-template-store-wish-list/)
- [/n8n-wordpress-api-integration-guide/](http://localhost:4321/n8n-wordpress-api-integration-guide/)
- [/nextjs-geoip-memory-optimization/](http://localhost:4321/nextjs-geoip-memory-optimization/)
- [/nfs-version-nfs4-nfs3-io-blocking/](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking/)
- [/nginx-cache-wordpress/](http://localhost:4321/nginx-cache-wordpress/)
- [/privacy-policy/](http://localhost:4321/privacy-policy/)
- [/raspberry-pi-gpio-high-frequency-noise/](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise/)
- [/raspberry-pi-gpio-software-debounce-guide/](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide/)
- [/tag/%E6%A8%A1%E6%9D%BF/](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF/)
- [/threads-data-export-tutorial/](http://localhost:4321/threads-data-export-tutorial/)
- [/wordpress-migrate-to-zeabur/](http://localhost:4321/wordpress-migrate-to-zeabur/)
- [/zeabur-nginx-subdomain-to-subdirectory/](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory/)

</details>

---

#### Links

*0 error(s), 1 warning(s)*

##### Broken External Links **[WARN]**

`links/broken-external-links`

> Detects external links returning 4xx/5xx errors or timeouts

**Solution:**

Broken external links hurt user experience and credibility. Regularly audit external links using automated tools. Remove or replace broken links with working alternatives. Consider using archived versions (archive.org) if the original content is gone. For important resources, consider hosting your own copies of critical documentation or linking to more stable sources.

| Check | Status | Message |
|-------|--------|---------|
| broken-external-links | ! warn | 4 broken external link(s): 2 failed, 1 with 404, 1 with 999 |

<details><summary><strong>broken-external-links:</strong> 40 page(s) affected</summary>

- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

<details><summary><strong>broken-external-links:</strong> 4 item(s)</summary>

- [https://charlsondou.com/get-instagram-api-token-auto-update/#Token_yan_zhang_yu_zi_dong_shua_xin (Error: timeout)](https://charlsondou.com/get-instagram-api-token-auto-update/#Token_yan_zhang_yu_zi_dong_shua_xin)
  - from: [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md (404)](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md)
  - from: [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [https://www.linkedin.com/in/frankchen0130/ (999)](https://www.linkedin.com/in/frankchen0130/)
  - from: [/](http://localhost:4321/)
  - from: [/about](http://localhost:4321/about)
  - from: [/articles](http://localhost:4321/articles)
  - +37 more (see full list above)
- [https://your.wordpress.url/wp-json/wp/v2/media)%EF%BC%8CWordPress (Error: Was there a typo in the url or port?)](https://your.wordpress.url/wp-json/wp/v2/media)%EF%BC%8CWordPress)
  - from: [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)

</details>

---

#### Content

*0 error(s), 42 warning(s)*

##### Keyword Stuffing **[WARN]**

`content/keyword-stuffing`

> Detects excessive keyword repetition in content

**Solution:**

Keyword stuffing is repeating words unnaturally to manipulate rankings. Search engines penalize this practice. Write naturally for users first. Use keywords where they fit naturally. Aim for 1-2% keyword density at most. Use synonyms and related terms instead of repeating the exact same phrase. Focus on providing value, not gaming algorithms.

| Check | Status | Message |
|-------|--------|---------|
| keyword-stuffing | ! warn | N word(s) may be overused |

<details><summary><strong>keyword-stuffing:</strong> 25 page(s) affected</summary>

- [/articles](http://localhost:4321/articles)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

<details><summary><strong>keyword-stuffing:</strong> 94 item(s)</summary>

- "access" (7.0%)
- "android" (3.6%)
- "api" (8.9%)
- "app" (4.4%)
- "block" (4.4%)
- "bot" (11.4%)
- "botfather" (3.8%)
- "buttonpin" (4.6%)
- "cache" (10.5%)
- "canva" (14.2%)
- "cdn" (4.2%)
- "channel" (3.5%)
- "chat" (4.4%)
- "claude" (13.1%)
- "cli" (15.3%)
- "cloud" (8.2%)
- "cloudflare" (11.1%)
- "collectors" (3.2%)
- "com" (4.5%)
- "csv" (15.4%)
- "currentstate" (3.6%)
- "data" (12.0%)
- "database" (14.2%)
- "debounce" (5.1%)
- "devops" (7.6%)
- "discord" (5.4%)
- "drive" (3.8%)
- "end" (7.7%)
- "facebook" (5.4%)
- "flutter" (8.6%)
- "fstab" (4.1%)
- "function" (4.1%)
- "gemini" (16.1%)
- "generators" (4.3%)
- "geoip" (14.1%)
- "github" (4.2%)
- "google" (4.0%)
- "gpio" (4.6%)
- "graph" (3.5%)
- "header" (3.9%)
- "headers" (4.7%)
- "high" (3.1%)
- "html" (3.4%)
- "instagram" (4.0%)
- "integration" (4.3%)
- "isr" (3.1%)
- "key" (3.2%)
- "laststablestate" (4.6%)
- "line" (7.4%)
- "lite" (6.2%)
- "loop" (4.6%)
- "message" (3.8%)
- "messaging" (6.5%)
- "meta" (4.8%)
- "mfa" (3.4%)
- "migration" (3.3%)
- "mnt" (5.4%)
- "nfs" (31.0%)
- "nginx" (3.5%)
- "node" (4.7%)
- "notion" (4.5%)
- "null" (4.0%)
- "oauth" (4.8%)
- "one" (3.3%)
- "organizers" (4.3%)
- "page" (7.2%)
- "parser" (3.2%)
- "personal" (3.7%)
- "pipeline" (3.2%)
- "print" (3.1%)
- "properties" (4.3%)
- "proxy" (5.0%)
- "reply" (4.3%)
- "rules" (6.7%)
- "scope" (3.8%)
- "secret" (3.2%)
- "secure" (3.6%)
- "seo" (3.2%)
- "set" (3.2%)
- "skill" (4.2%)
- "skills" (7.7%)
- "slug" (4.5%)
- "storage" (6.0%)
- "sudo" (3.6%)
- "table" (12.0%)
- "telegram" (5.4%)
- "then" (4.1%)
- "time" (4.1%)
- "token" (4.5%)
- "trigger" (3.3%)
- "url" (3.1%)
- "webhook" (3.4%)
- "wordpress" (6.7%)
- "zeabur" (3.7%)

</details>

---

##### Word Count **[WARN]**

`content/word-count`

> Checks content length for thin content issues

**Solution:**

Pages with thin content (under 300 words) often struggle to rank well and are actively deindexed by Google since the June 2025 core update. Add more valuable, relevant content to thin pages—aim for at least 500 words for standard pages and 1000+ for in-depth articles. If a page can't be fleshed out, voluntarily noindex it or consolidate it into a more comprehensive resource. Trimming thin pages from your index is better than leaving low-value content for Google to penalize.

| Check | Status | Message |
|-------|--------|---------|
| word-count | ! warn | Thin content: N words (min N) |

<details><summary><strong>word-count:</strong> 17 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)

</details>

---

#### Structured Data

*28 error(s), 0 warning(s)*

##### JSON-LD Valid **[WARN]**

`schema/json-ld-valid`

> Validates JSON-LD structured data

**Solution:**

JSON-LD structured data helps search engines understand your content and can unlock rich results. Validate against schema.org rules (headline, author, datePublished for articles, name/url for organizations, etc.) and keep the JSON well-formed. Use SquirrelScan's built-in schema validator to expose the exact missing property path before verifying on Google's Rich Results Test, and ensure each required field points to a canonical resource.

| Check | Status | Message |
|-------|--------|---------|
| json-ld-valid | X fail | Invalid JSON-LD syntax |

<details><summary><strong>json-ld-valid:</strong> 28 page(s) affected</summary>

- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

<details><summary><strong>json-ld-valid:</strong> 4 item(s)</summary>

- Article missing publisher.logo
- Article missing publisher.name
- Validation: Article.publisher.name is required
- Validation: Article.publisher.logo is required

</details>

---

#### Images

*40 error(s), 67 warning(s)*

##### Image Alt Text **[WARN]**

`images/alt-text`

> Validates image alt attributes

**Solution:**

Alt text describes images for screen readers and displays when images fail to load. It's essential for accessibility and helps with image search SEO. Add descriptive alt text to all meaningful images. Keep it concise (under 125 characters) but descriptive. For decorative images, use empty alt="" to indicate they should be skipped by screen readers. Avoid keyword stuffing in alt text.

| Check | Status | Message |
|-------|--------|---------|
| alt-text-missing | X fail | 2 image(s) missing alt text |

<details><summary><strong>alt-text-missing:</strong> 41 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)
- [/logo.webp](http://localhost:4321/logo.webp)

</details>

---

##### Offscreen Image Lazy Loading **[WARN]**

`images/offscreen-lazy`

> Checks if offscreen images use lazy loading

**Solution:**

Add loading='lazy' to images below the fold to defer loading until needed. This reduces initial page load time and saves bandwidth. Exception: Don't lazy-load LCP image or above-the-fold content. Use loading='eager' for critical images.

| Check | Status | Message |
|-------|--------|---------|
| offscreen-images-not-lazy | ! warn | 1 below-fold image(s) without lazy loading |

<details><summary><strong>offscreen-images-not-lazy:</strong> 27 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

<details><summary><strong>offscreen-images-not-lazy:</strong> 1 item(s)</summary>

- logo.webp

</details>

---

##### Responsive Image Size **[WARN]**

`images/responsive-size`

> Checks if images are sized appropriately for their display size

**Solution:**

Serve images at appropriate sizes for their display dimensions. Oversized images waste bandwidth and slow page load. Undersized images look blurry on high-DPI displays. Use srcset to serve different sizes for different screens. For responsive images, serve 1x, 2x, and optionally 3x versions. Image CDNs can automatically resize images on-the-fly.

| Check | Status | Message |
|-------|--------|---------|
| images-possibly-oversized | ! warn | N small image(s) may be serving oversized files |

<details><summary><strong>images-possibly-oversized:</strong> 40 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

<details><summary><strong>images-possibly-oversized:</strong> 10 item(s)</summary>

- darrell.webp (72x72, no srcset)
- geekaz.webp (72x72, no srcset)
- hc-ai.webp (72x72, no srcset)
- lazyoffice.webp (72x72, no srcset)
- logo.webp (56x56, no srcset)
- logo.webp (64x64, no srcset)
- papaya.webp (72x72, no srcset)
- tpl-ai-assistant.webp (72x72, no srcset)
- tpl-creditcard.webp (72x72, no srcset)
- tpl-interviewer.webp (72x72, no srcset)

</details>

---

#### E-E-A-T

*0 error(s), 1 warning(s)*

##### Contact Page **[WARN]**

`eeat/contact-page`

> Checks for contact page with multiple contact methods

**Solution:**

A contact page with multiple contact methods builds trust. Include: email address or contact form, phone number (if applicable), physical address, and social media links. Make contact information easy to find from any page. For local businesses, include business hours. Response time expectations are also helpful.

| Check | Status | Message |
|-------|--------|---------|
| contact-page | ! warn | No Contact page found |

---

### Performance

*2 error(s), 210 warning(s)*

#### HTTP/2 *[Recommendation]*

`perf/http2`

> Checks for HTTP/2 protocol support

**Solution:**

HTTP/2 enables multiplexing, header compression, and server push for faster page loads. Most modern web servers and CDNs support HTTP/2 out of the box. Requires HTTPS. Check your server/CDN documentation to enable it. HTTP/3 (QUIC) provides even better performance.

| Check | Status | Message |
|-------|--------|---------|
| http2-https-required | ! warn | HTTP/2 requires HTTPS |

<details><summary><strong>http2-https-required:</strong> 40 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

---

#### LCP Optimization Hints **[WARN]**

`perf/lcp-hints`

> Checks for Largest Contentful Paint optimization opportunities

**Solution:**

LCP measures when the largest content element becomes visible. Optimize by: 1) Preload your LCP image with <link rel='preload' as='image'>. 2) Don't use loading='lazy' on above-fold images as it delays loading. 3) Minimize render-blocking CSS/JS in <head>. 4) Use modern image formats (WebP/AVIF) for faster loading. 5) Consider using fetchpriority='high' on the LCP image.

| Check | Status | Message |
|-------|--------|---------|
| lcp-preload | ! warn | 2 likely-LCP images loaded without preload |

<details><summary><strong>lcp-preload:</strong> 40 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

---

#### CSS File Size Too Large **[WARN]**

`perf/css-file-size`

> Checks for CSS files that exceed recommended size limits

**Solution:**

Large CSS files slow down rendering and increase bandwidth. Split large stylesheets into smaller chunks, remove unused selectors, and minify CSS. Consider critical CSS inlining for above-the-fold styles and lazy-loading non-critical CSS.

| Check | Status | Message |
|-------|--------|---------|
| css-file-size-warn | ! warn | 1 CSS file(s) exceed 150.0 KB |

<details><summary><strong>css-file-size-warn:</strong> 40 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

<details><summary><strong>css-file-size-warn:</strong> 1 item(s)</summary>

- [http://localhost:4321/_astro/_slug_.n3tw9ZXz.css](http://localhost:4321/_astro/_slug_.n3tw9ZXz.css)
  - from: [/](http://localhost:4321/)
  - from: [/about](http://localhost:4321/about)
  - from: [/articles](http://localhost:4321/articles)
  - +37 more (see full list above)

</details>

---

#### DOM Size **[WARN]**

`perf/dom-size`

> Detects excessive DOM complexity that impacts performance

**Solution:**

Large DOMs slow page rendering, increase memory usage, and harm mobile performance. Google recommends keeping total nodes under 1500.

Fixes for large DOMs:
- Use virtualization for long lists (e.g., react-window)
- Lazy-load off-screen content
- Reduce unnecessary wrapper elements
- Use CSS instead of DOM for visual effects
- Paginate large content sections

| Check | Status | Message |
|-------|--------|---------|
| dom-max-children | ! warn | Element with N children found |

<details><summary><strong>dom-max-children:</strong> 18 page(s) affected</summary>

- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

---

#### Total Page Weight **[WARN]**

`perf/total-byte-weight`

> Checks the total byte weight of the page

**Solution:**

Reduce total page weight for faster loads on slow connections. Optimize images (use modern formats, compress, serve appropriate sizes). Minify and compress CSS/JS. Remove unused code via tree-shaking. Lazy-load non-critical resources. Target under 1.6MB for mobile users.

| Check | Status | Message |
|-------|--------|---------|
| total-byte-weight | X fail | Total tracked resources: 6386KB (very heavy) |

---

#### Weak Caching (site-wide) **[WARN]**

`perf/bad-caching`

> Flags sites where most pages lack caching freshness, validators, or compression

**Solution:**

Set Cache-Control with an appropriate max-age on every response (short for HTML, long + immutable for hashed static assets), expose an ETag or Last-Modified for cheap revalidation, and enable gzip/Brotli for text responses. Consistent caching across the whole site cuts repeat-visit load times and origin/CDN cost.

| Check | Status | Message |
|-------|--------|---------|
| bad-caching-freshness | X fail | 40/40 pages lack a caching freshness lifetime |

<details><summary><strong>bad-caching-freshness:</strong> 5 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)

</details>

---

#### Critical Request Chains **[WARN]**

`perf/critical-request-chains`

> Identifies chains of dependent resources that delay rendering

**Solution:**

Critical request chains are sequences of dependent network requests that must complete before the page can render. Reduce chain depth by: 1) Inlining critical CSS instead of linking external files. 2) Adding async or defer to non-critical scripts. 3) Avoiding CSS @import — use <link> tags instead. 4) Using <link rel='preload'> for critical resources. 5) Reducing the number of render-blocking resources in <head>.

| Check | Status | Message |
|-------|--------|---------|
| critical-request-chains | ! warn | N critical request chain(s) found |

<details><summary><strong>critical-request-chains:</strong> 40 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

<details><summary><strong>critical-request-chains:</strong> 4 item(s)</summary>

- CSS: /_astro/_slug_.DDhnpoCE.css
- CSS: /_astro/_slug_.n3tw9ZXz.css
- CSS: /_astro/about.DQBMRoo2.css
- CSS: /_astro/n8n-resources.J9ATjL5h.css

</details>

---

#### Lazy Loading Above Fold **[WARN]**

`perf/lazy-above-fold`

> Detects lazy loading on likely above-fold images

**Solution:**

Don't use loading='lazy' on images that appear above the fold (visible without scrolling). Lazy loading these images delays LCP because the browser waits for layout before fetching. For hero images and LCP candidates: 1) Remove loading='lazy'. 2) Add fetchpriority='high'. 3) Consider preloading with <link rel='preload' as='image'>. Only use lazy loading for below-fold images.

| Check | Status | Message |
|-------|--------|---------|
| lazy-above-fold | ! warn | N above-fold image(s) with lazy loading |

<details><summary><strong>lazy-above-fold:</strong> 31 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

<details><summary><strong>lazy-above-fold:</strong> 54 item(s)</summary>

- [/_astro/botfather-official-page-start-bot.C7-xNNd-_Z2bLlVd.webp](/_astro/botfather-official-page-start-bot.C7-xNNd-_Z2bLlVd.webp)
- [/_astro/button-mechanical-bounce-diagram.FxSodXxx_ZX9VRM.webp](/_astro/button-mechanical-bounce-diagram.FxSodXxx_ZX9VRM.webp)
- [/_astro/canva-account-settings-page.DX25nkyi_1yIqt4.webp](/_astro/canva-account-settings-page.DX25nkyi_1yIqt4.webp)
- [/_astro/cover.3hPSRl8j_Zcsoc0.webp](/_astro/cover.3hPSRl8j_Zcsoc0.webp)
- [/_astro/cover.BJWTHlAt_2og2wo.webp](/_astro/cover.BJWTHlAt_2og2wo.webp)
- [/_astro/cover.BMimPQOe_Z1txvMA.webp](/_astro/cover.BMimPQOe_Z1txvMA.webp)
- [/_astro/cover.BRfBlp-v_2jkmNl.webp](/_astro/cover.BRfBlp-v_2jkmNl.webp)
- [/_astro/cover.BS2N-OxW_7zt7E.webp](/_astro/cover.BS2N-OxW_7zt7E.webp)
- [/_astro/cover.BcaKidZI_2eYDY6.webp](/_astro/cover.BcaKidZI_2eYDY6.webp)
- [/_astro/cover.C5-GKiKc_Z1cAECb.webp](/_astro/cover.C5-GKiKc_Z1cAECb.webp)
- [/_astro/cover.C6Vu5cop_97UsN.webp](/_astro/cover.C6Vu5cop_97UsN.webp)
- [/_astro/cover.CFesRJev_Z1wcst8.webp](/_astro/cover.CFesRJev_Z1wcst8.webp)
- [/_astro/cover.CH8Tw3fV_PuMQg.webp](/_astro/cover.CH8Tw3fV_PuMQg.webp)
- [/_astro/cover.CI_EQyDW_Z1UO2vl.webp](/_astro/cover.CI_EQyDW_Z1UO2vl.webp)
- [/_astro/cover.CJF5jpDF_Z2eXhOw.webp](/_astro/cover.CJF5jpDF_Z2eXhOw.webp)
- [/_astro/cover.CP8Qymwl_ZeeiCt.webp](/_astro/cover.CP8Qymwl_ZeeiCt.webp)
- [/_astro/cover.CQsDDHpJ_16iuNB.webp](/_astro/cover.CQsDDHpJ_16iuNB.webp)
- [/_astro/cover.CaMneqxd_1idpF1.webp](/_astro/cover.CaMneqxd_1idpF1.webp)
- [/_astro/cover.CcOkF1qS_GKUGf.webp](/_astro/cover.CcOkF1qS_GKUGf.webp)
- [/_astro/cover.DKUjEKxw_14SDX.webp](/_astro/cover.DKUjEKxw_14SDX.webp)
- [/_astro/cover.DSSlCh0k_Z1FSCfb.webp](/_astro/cover.DSSlCh0k_Z1FSCfb.webp)
- [/_astro/cover.DVAoR-xQ_1aYFIQ.webp](/_astro/cover.DVAoR-xQ_1aYFIQ.webp)
- [/_astro/cover.DVB0wvsO_1zC9V7.webp](/_astro/cover.DVB0wvsO_1zC9V7.webp)
- [/_astro/cover.DWtjpEbD_ZWcnSJ.webp](/_astro/cover.DWtjpEbD_ZWcnSJ.webp)
- [/_astro/cover.D_n30VQu_Z2lqry.webp](/_astro/cover.D_n30VQu_Z2lqry.webp)
- [/_astro/cover.DcFupUSJ_Z1QvO6W.webp](/_astro/cover.DcFupUSJ_Z1QvO6W.webp)
- [/_astro/cover.Dtopm0VM_O1VG1.webp](/_astro/cover.Dtopm0VM_O1VG1.webp)
- [/_astro/cover.SP7Upri5_Z22p90t.webp](/_astro/cover.SP7Upri5_Z22p90t.webp)
- [/_astro/cover.Uluyvjo9_1hEhaU.webp](/_astro/cover.Uluyvjo9_1hEhaU.webp)
- [/_astro/cover.bhmCV4i6_Zsj3dW.webp](/_astro/cover.bhmCV4i6_Zsj3dW.webp)
- [/_astro/cover.dRBpIiKI_ZpspQs.webp](/_astro/cover.dRBpIiKI_ZpspQs.webp)
- [/_astro/data-table-create-button.DCEV26Pw_Z1DCH9T.webp](/_astro/data-table-create-button.DCEV26Pw_Z1DCH9T.webp)
- [/_astro/data-table-download-csv-button.DcsDuyCq_Qvt7I.webp](/_astro/data-table-download-csv-button.DcsDuyCq_Qvt7I.webp)
- [/_astro/discord-developer-portal-new-application.CrN3Hh_u_Z1WRdke.webp](/_astro/discord-developer-portal-new-application.CrN3Hh_u_Z1WRdke.webp)
- [/_astro/frank-avatar.BYWjJAa8_1xltB0.webp](/_astro/frank-avatar.BYWjJAa8_1xltB0.webp)
- [/_astro/high-frequency-noise-waveform.DI-JUD48_myyWY.webp](/_astro/high-frequency-noise-waveform.DI-JUD48_myyWY.webp)
- [/_astro/hosting-bill-before-after-cache.BCKZKdAl_1z0xL1.webp](/_astro/hosting-bill-before-after-cache.BCKZKdAl_1z0xL1.webp)
- [/_astro/instagram-account-center-navigation.C-lzfU_F_1rg2nL.webp](/_astro/instagram-account-center-navigation.C-lzfU_F_1rg2nL.webp)
- [/_astro/instagram-linked-facebook-page.Bs2j1Pye_Z2t8coh.webp](/_astro/instagram-linked-facebook-page.Bs2j1Pye_Z2t8coh.webp)
- [/_astro/line-bot-setup-flow.BvLdlNGW_20Ru7c.webp](/_astro/line-bot-setup-flow.BvLdlNGW_20Ru7c.webp)
- [/_astro/line-developers-login-page.C1MubwAe_ZDKyDM.webp](/_astro/line-developers-login-page.C1MubwAe_ZDKyDM.webp)
- [/_astro/login-auth-options.DPR95NTK_2n8wHr.webp](/_astro/login-auth-options.DPR95NTK_2n8wHr.webp)
- [/_astro/n8n-app-screenshot.BHX9AgRT_Zf2Y5t.webp](/_astro/n8n-app-screenshot.BHX9AgRT_Zf2Y5t.webp)
- [/_astro/n8n-google-services-list.CzF4Pewg_ZePwS0.webp](/_astro/n8n-google-services-list.CzF4Pewg_ZePwS0.webp)
- [/_astro/nfs-client-server-architecture.Ca-kWpNN_Z26BN14.webp](/_astro/nfs-client-server-architecture.Ca-kWpNN_Z26BN14.webp)
- [/_astro/node-properties-json-comparison.CE74Ea4q_Z1lzpFn.webp](/_astro/node-properties-json-comparison.CE74Ea4q_Z1lzpFn.webp)
- [/_astro/notion-integrations-management-page.B3o-hj_W_ZOvgnr.webp](/_astro/notion-integrations-management-page.B3o-hj_W_ZOvgnr.webp)
- [/_astro/old-subdomain-architecture-diagram.vG1tlFcg_Z168JOT.webp](/_astro/old-subdomain-architecture-diagram.vG1tlFcg_Z168JOT.webp)
- [/_astro/samsung-wallet-add-nfc-access-card-steps.BZFB40jw_1QsMX6.webp](/_astro/samsung-wallet-add-nfc-access-card-steps.BZFB40jw_1QsMX6.webp)
- [/_astro/wordpress-application-password-section.1yml1gJi_1Dtlc3.webp](/_astro/wordpress-application-password-section.1yml1gJi_1Dtlc3.webp)
- [/_astro/workflow-overview.CEI8B3CF_6zdMb.webp](/_astro/workflow-overview.CEI8B3CF_6zdMb.webp)
- [/_astro/workflow-overview.DITV4sYZ_laWdv.webp](/_astro/workflow-overview.DITV4sYZ_laWdv.webp)
- [/_astro/zeabur-memory-dashboard-before-optimization.BeB8njW8_Z2k6sw7.webp](/_astro/zeabur-memory-dashboard-before-optimization.BeB8njW8_Z2k6sw7.webp)
- [/_astro/zeabur-pricing-plan.B3mTGjdQ_1iRT9l.webp](/_astro/zeabur-pricing-plan.B3mTGjdQ_1iRT9l.webp)

</details>

---

#### Unminified CSS **[WARN]**

`perf/unminified-css`

> Detects unminified CSS that could be optimized

**Solution:**

Minify CSS to reduce file size and improve load times. Use build tools like cssnano, clean-css, or PostCSS with cssnano plugin. Most bundlers (Webpack, Vite, esbuild) can minify CSS automatically in production mode. Minification removes whitespace, comments, and optimizes syntax.

| Check | Status | Message |
|-------|--------|---------|
| unminified-css | ! warn | 1 CSS file(s) appear unminified |

<details><summary><strong>unminified-css:</strong> 40 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

<details><summary><strong>unminified-css:</strong> 1 item(s)</summary>

- 2.2KB, ~0.0KB savings

</details>

---

### Security

*41 error(s), 3 warning(s)*

#### Security

*41 error(s), 2 warning(s)*

##### Leaked Environment Variables **[ERROR]**

`security/leaked-secrets`

> Checks for exposed API keys, secrets, and credentials in HTML/JS

**Solution:**

API keys and secrets exposed in client-side code can be harvested by attackers to access your services, incur charges, or steal data. Move sensitive credentials to server-side code and use environment variables that are NOT exposed to the browser. For frontend apps, use a backend proxy to make authenticated API calls. Rotate any exposed credentials immediately. Consider using secret scanning tools like Gitleaks or TruffleHog in your CI/CD pipeline to prevent future leaks.

| Check | Status | Message |
|-------|--------|---------|
| leaked-secrets-high | X fail | 1 high-confidence leaked secret(s) detected |

<details><summary><strong>leaked-secrets-high:</strong> 1 item(s)</summary>

- Found in html (http://localhost:4321/n8n-telegram-bot-notification-tutorial)

</details>

---

##### HTTPS **[ERROR]**

`security/https`

> Checks for HTTPS usage

**Solution:**

HTTPS encrypts data between users and your server, protecting sensitive information. It's a ranking signal and required for many modern browser features. Migrate to HTTPS by obtaining an SSL certificate (free from Let's Encrypt). Update internal links to use https://. Set up 301 redirects from HTTP to HTTPS. Update your canonical URLs and sitemap. Check for mixed content warnings after migration.

| Check | Status | Message |
|-------|--------|---------|
| https | X fail | Page not served over HTTPS |

<details><summary><strong>https:</strong> 40 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/cloudflare-cache-rules-wordpress](http://localhost:4321/cloudflare-cache-rules-wordpress)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-canva-oauth-setup](http://localhost:4321/n8n-canva-oauth-setup)
- [/n8n-credentials-setup-complete-guide](http://localhost:4321/n8n-credentials-setup-complete-guide)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-discord-bot-setup-tutorial](http://localhost:4321/n8n-discord-bot-setup-tutorial)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-instagram-access-token](http://localhost:4321/n8n-instagram-access-token)
- [/n8n-line-api-integration-tutorial](http://localhost:4321/n8n-line-api-integration-tutorial)
- [/n8n-line-discord-telegram-bot-comparison](http://localhost:4321/n8n-line-discord-telegram-bot-comparison)
- [/n8n-notion-api-integration-tutorial](http://localhost:4321/n8n-notion-api-integration-tutorial)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-skills-claude-ai-skill-pack-tutorial](http://localhost:4321/n8n-skills-claude-ai-skill-pack-tutorial)
- [/n8n-skills-four-layer-pipeline-architecture](http://localhost:4321/n8n-skills-four-layer-pipeline-architecture)
- [/n8n-telegram-bot-notification-tutorial](http://localhost:4321/n8n-telegram-bot-notification-tutorial)
- [/n8n-template-line-bot-upload-system](http://localhost:4321/n8n-template-line-bot-upload-system)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/n8n-wordpress-api-integration-guide](http://localhost:4321/n8n-wordpress-api-integration-guide)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/nginx-cache-wordpress](http://localhost:4321/nginx-cache-wordpress)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/wordpress-migrate-to-zeabur](http://localhost:4321/wordpress-migrate-to-zeabur)
- [/zeabur-nginx-subdomain-to-subdirectory](http://localhost:4321/zeabur-nginx-subdomain-to-subdirectory)

</details>

---

##### Content Security Policy **[WARN]**

`security/csp`

> Checks for Content-Security-Policy header and validates directives

**Solution:**

CSP prevents XSS attacks by restricting which resources can load. Start with a report-only policy to identify issues. Key directives: default-src 'self', script-src (avoid 'unsafe-inline'), img-src, style-src, frame-ancestors. Use nonces or hashes instead of 'unsafe-inline' for scripts. Test thoroughly as strict CSP can break functionality.

| Check | Status | Message |
|-------|--------|---------|
| csp-missing | ! warn | No Content-Security-Policy header |

---

##### X-Frame-Options **[WARN]**

`security/x-frame-options`

> Checks for clickjacking protection header

**Solution:**

X-Frame-Options prevents your site from being embedded in iframes, protecting against clickjacking attacks. Set: X-Frame-Options: DENY (no framing) or SAMEORIGIN (same origin only). For modern browsers, CSP frame-ancestors is preferred: Content-Security-Policy: frame-ancestors 'self'. Use both for maximum compatibility.

| Check | Status | Message |
|-------|--------|---------|
| x-frame-options | ! warn | No clickjacking protection |

---

#### Legal Compliance

*0 error(s), 1 warning(s)*

##### Sub-processor Disclosure *[Recommendation]*

`legal/subprocessor-disclosure`

> Checks for a sub-processor / data-processing (DPA) disclosure page or link

**Solution:**

Under GDPR Art. 28, processors must disclose the sub-processors they engage and offer a Data Processing Agreement (DPA). Publish a /subprocessors page listing each third party that handles customer personal data (purpose, location), keep it current, and link a DPA from your legal/trust pages. B2B SaaS and fintech buyers expect this during security review.

| Check | Status | Message |
|-------|--------|---------|
| subprocessor-disclosure | ! warn | No sub-processor / data-processing (DPA) disclosure found |

---

### Agents

*0 error(s), 27 warning(s)*

#### AGENTS.md *[Recommendation]*

`ax/agents-md`

> Detects /AGENTS.md (and variants) — plain-Markdown instructions for coding agents working against the site's repository

**Solution:**

If the site has an associated codebase, publish an AGENTS.md at the repository root covering setup, testing, and conventions a coding agent needs to be productive. This is a recommendation only — it never affects your score.

| Check | Status | Message |
|-------|--------|---------|
| agents-md-present | ! warn | No AGENTS.md found — this site publishes llms.txt, so consider an AGENTS.md for coding agents too |

---

#### Markdown Response *[Recommendation]*

`ax/markdown-response`

> Checks whether the site serves text/markdown via content negotiation (Accept: text/markdown) or exposes a .md variant of the homepage — agents increasingly prefer clean Markdown over rendered HTML

**Solution:**

Agents and answer engines parse Markdown more reliably than rendered HTML. Serve a Markdown representation of your key pages: honor `Accept: text/markdown` via content negotiation, and/or publish a `.md` variant (e.g. /index.md). This is a recommendation only — it never affects your score.

| Check | Status | Message |
|-------|--------|---------|
| markdown-response | ! warn | No Markdown response — consider honoring Accept: text/markdown or publishing a .md variant so agents get clean content |

---

#### Token Weight **[WARN]**

`ax/token-weight`

> Estimates the LLM token cost of a page's raw HTML and reports the text-to-HTML ratio — how much of that cost is actual content versus markup, scripts, and styles

**Solution:**

Strip or externalize inline <script>/<style> blocks, avoid deeply nested wrapper divs and long utility-class strings on content-bearing elements, and serve lean server-rendered markup rather than a client framework's verbose hydration output — especially on content pages. Consider Markdown content negotiation, which sidesteps the ratio problem by removing HTML markup from the response entirely.

| Check | Status | Message |
|-------|--------|---------|
| token-weight-ratio | ! warn | Visible text is under 15% of the page HTML — agents pay token cost mostly for markup, scripts, and styles |

<details><summary><strong>token-weight-ratio:</strong> 47 page(s) affected</summary>

- [/](http://localhost:4321/)
- [/about](http://localhost:4321/about)
- [/articles](http://localhost:4321/articles)
- [/category/devops](http://localhost:4321/category/devops)
- [/category/flutter](http://localhost:4321/category/flutter)
- [/category/n8n](http://localhost:4321/category/n8n)
- [/category/raspberry-pi](http://localhost:4321/category/raspberry-pi)
- [/category/tools](http://localhost:4321/category/tools)
- [/contact-frank](http://localhost:4321/contact-frank)
- [/flutter-secure-storage-android-key-problem](http://localhost:4321/flutter-secure-storage-android-key-problem)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota)
- [/n8n-data-table-csv-export-import](http://localhost:4321/n8n-data-table-csv-export-import)
- [/n8n-google-credentials-setup-guide](http://localhost:4321/n8n-google-credentials-setup-guide)
- [/n8n-notion-wordpress-publish-automation](http://localhost:4321/n8n-notion-wordpress-publish-automation)
- [/n8n-resources](http://localhost:4321/n8n-resources)
- [/n8n-template-store-wish-list](http://localhost:4321/n8n-template-store-wish-list)
- [/nextjs-geoip-memory-optimization](http://localhost:4321/nextjs-geoip-memory-optimization)
- [/nfs-version-nfs4-nfs3-io-blocking](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking)
- [/privacy-policy](http://localhost:4321/privacy-policy)
- [/raspberry-pi-gpio-high-frequency-noise](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise)
- [/raspberry-pi-gpio-software-debounce-guide](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide)
- [/tag/%E6%A8%A1%E6%9D%BF](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF)
- [/threads-data-export-tutorial](http://localhost:4321/threads-data-export-tutorial)
- [/about/](http://localhost:4321/about/)
- [/articles/](http://localhost:4321/articles/)
- [/category/devops/](http://localhost:4321/category/devops/)
- [/category/flutter/](http://localhost:4321/category/flutter/)
- [/category/n8n/](http://localhost:4321/category/n8n/)
- [/category/raspberry-pi/](http://localhost:4321/category/raspberry-pi/)
- [/category/tools/](http://localhost:4321/category/tools/)
- [/contact-frank/](http://localhost:4321/contact-frank/)
- [/flutter-secure-storage-android-key-problem/](http://localhost:4321/flutter-secure-storage-android-key-problem/)
- [/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota/](http://localhost:4321/google-new-opensource-too-gemini-cli-providing-a-large-amount-of-free-quota/)
- [/n8n-data-table-csv-export-import/](http://localhost:4321/n8n-data-table-csv-export-import/)
- [/n8n-google-credentials-setup-guide/](http://localhost:4321/n8n-google-credentials-setup-guide/)
- [/n8n-notion-wordpress-publish-automation/](http://localhost:4321/n8n-notion-wordpress-publish-automation/)
- [/n8n-resources/](http://localhost:4321/n8n-resources/)
- [/n8n-template-store-wish-list/](http://localhost:4321/n8n-template-store-wish-list/)
- [/nextjs-geoip-memory-optimization/](http://localhost:4321/nextjs-geoip-memory-optimization/)
- [/nfs-version-nfs4-nfs3-io-blocking/](http://localhost:4321/nfs-version-nfs4-nfs3-io-blocking/)
- [/privacy-policy/](http://localhost:4321/privacy-policy/)
- [/raspberry-pi-gpio-high-frequency-noise/](http://localhost:4321/raspberry-pi-gpio-high-frequency-noise/)
- [/raspberry-pi-gpio-software-debounce-guide/](http://localhost:4321/raspberry-pi-gpio-software-debounce-guide/)
- [/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide/](http://localhost:4321/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide/)
- [/tag/%E6%A8%A1%E6%9D%BF/](http://localhost:4321/tag/%E6%A8%A1%E6%9D%BF/)
- [/threads-data-export-tutorial/](http://localhost:4321/threads-data-export-tutorial/)

</details>

---

#### AI Crawler Access **[WARN]**

`ax/ai-crawlers`

> Classifies AI-agent crawlers (training, AI-search, user-action, archive) and reports which robots.txt allows or blocks

**Solution:**

AI assistants and answer engines read your site through named crawlers, but 'AI crawlers' is really several policies. Blocking TRAINING crawlers (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, Meta-ExternalAgent, Amazonbot, Bytespider) only affects one vendor's future model training — a legitimate choice that never penalizes your score. ARCHIVE crawlers (CCBot, ia_archiver) are different: they feed the Common Crawl corpus and the Wayback Machine, the shared sources AI training sets are built from, so blocking them opts you out of every downstream model and archive at once — this rule warns on it. Blocking AI-SEARCH indexers (OAI-SearchBot, Claude-SearchBot, PerplexityBot) drops you from AI-generated search citations; blocking USER-ACTION fetchers (ChatGPT-User, Claude-User, Perplexity-User) breaks live requests a real person made inside an assistant — both are usually accidental, so this rule warns on them. Note these are separate user-agents: blocking ClaudeBot (training) does NOT block Claude-User (user-action). To opt out of training while staying answerable, block the training bots but keep the AI-search and user-action ones allowed.

| Check | Status | Message |
|-------|--------|---------|
| archive-crawler-access | ! warn | robots.txt blocks archive crawlers — this removes the site from the Wayback Machine and/or the Common Crawl corpus, the archives AI training sets are built from. Blocking CCBot opts you out of every model trained on Common Crawl, not just one vendor. |

<details><summary><strong>archive-crawler-access:</strong> 1 item(s)</summary>

- CCBot (Common Crawl, open crawl corpus) — blocked

</details>

---

---

*Generated by [squirrelscan](https://squirrelscan.com) v0.0.79*