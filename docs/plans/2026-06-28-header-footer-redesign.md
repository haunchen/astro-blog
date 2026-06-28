# Header / Footer 改版 Implementation Plan

Goal: 把 Astro 站的 header 與 footer 改成貼近原 WordPress 站的設計（高版 header＋捲動收合、品牌化 footer），並補上 tag 路由頁、`/tag/` 標籤雲與 `/n8n-resources/` 占位頁，確保全站無死連結。

Architecture: 連結與顯示字串集中到 `src/utils/site-meta.ts` 單一來源；`Nav.astro` 改寫成完整 header（sticky 高版 + IntersectionObserver 收合 + 文章下拉 + 手機漢堡），`Footer.astro` 改寫（頭像/標題/描述/社群/兩欄/copyright），社群圖示抽成 `SocialIcons.astro`；新增 `pages/tag/[tag].astro`（重用 `ArticleTimeline`）、`pages/tag/index.astro`（標籤雲）、`pages/n8n-resources.astro`（stub）。

Tech Stack: Astro v5、Tailwind v4（透過 global.css 的 `@theme` design tokens）、TypeScript strict、原生 DOM script（IntersectionObserver）。本專案**無 test runner / lint**（見 CLAUDE.md），故每個 task 的驗證步驟以 `npm run build` 通過＋針對性 grep／檔案檢查為準，整合抽驗用 Chrome。

Spec: `docs/specs/site-pages.md`（Pending Changes：R14–R17、MODIFIED R9、D12–D17）

設計文件：`docs/plans/2026-06-28-header-footer-redesign-design.md`

關鍵既有事實（implementer 不需再讀別處）：
- `BaseLayout.astro` 以 `import Nav from '../components/Nav.astro'` 與 `import Footer from '../components/Footer.astro'` 組裝，body 內 `<Nav /> <slot /> <Footer />`。**保留這兩個檔名**，不改 BaseLayout。
- design tokens（`src/styles/global.css` 的 `@theme`）：色 `--color-bg-primary/secondary/tertiary`、`--color-text-primary/secondary/muted`、`--color-brand-orange:#fb923c`、`--color-border-default/subtle`；圓角 `--radius-md/full`；字 `--font-sans/serif/mono`；寬 `--width-max:1200px/--width-wide:960px`；`einkRefresh` keyframes 已存在；`prefers-reduced-motion` 已全域停用動畫。
- `.list-page/.list-head/.list-title/.list-sub` 已在 global.css 定義（tag 頁直接套用）。
- `ArticleTimeline.astro` 的 props 是 `{ posts: CollectionEntry<'posts'>[] }`，內部自行排序分組，直接傳文章陣列即可。
- `site-meta.ts` 現有 `SITE`（含 `sameAs` 順序為 threads, instagram, github, linkedin；`email`）、`CATEGORIES`、`CATEGORY_LABEL`、`categoryLabel()`、`ORGANIZATION_JSONLD`、`WEBSITE_JSONLD`。`logo.webp` 在 `public/`。
- content schema 有 `tags: z.array(z.string()).default([])`；「模板」tag 有 3 篇。

---

### Task 1: site-meta.ts 新增顯示字串、SOCIAL、HEADER_NAV、FOOTER_COLS

Implements: `site-pages.md` #R14, #R15, D13, D14, D16

Files:
- Modify: `src/utils/site-meta.ts`（在 `SITE` 物件內補欄位；在檔尾、`CATEGORIES` 之後新增 `SOCIAL`/`HEADER_NAV`/`FOOTER_COLS` 匯出）

Step 1: 在 `SITE` 物件補三個顯示字串欄位。把現有：

```ts
export const SITE = {
  name: '下班後的工程師筆記',
  tagline: '白天上班，下班寫 Side Project。',
  url: 'https://frankchen.tw',
  logo: 'https://frankchen.tw/logo.webp',
  email: 'frank@frankchen.tw',
  sameAs: [
```

改為（在 `tagline` 後插入 `title`/`subtitle`/`description`；`sameAs` 陣列與 `} as const;` 結尾保持原樣不動）：

```ts
export const SITE = {
  name: '下班後的工程師筆記',
  tagline: '白天上班，下班寫 Side Project。',
  // header/footer 顯示用標題（暫用原站字串，實際「大標題」與 name 對齊待另議）
  title: '法蘭克｜不典型的軟體工程師',
  subtitle: '探索軟體世界，紀錄開發點滴',
  description: '從只會寫程式，到跨領域學習電路、製程、架站。在這裡分享實戰經驗、踩坑紀錄與自動化模板。',
  url: 'https://frankchen.tw',
  logo: 'https://frankchen.tw/logo.webp',
  email: 'frank@frankchen.tw',
  sameAs: [
```

Step 2: 在檔案最末端（最後一行 `WEBSITE_JSONLD` 物件之後）追加以下匯出：

```ts

// header/footer 導覽與連結單一來源 ---------------------------------

// 社群圖示：由 SITE.sameAs（threads/instagram/github/linkedin 順序）＋ email 推出
export const SOCIAL = [
  { icon: 'threads', label: 'Threads', href: SITE.sameAs[0] },
  { icon: 'instagram', label: 'Instagram', href: SITE.sameAs[1] },
  { icon: 'github', label: 'GitHub', href: SITE.sameAs[2] },
  { icon: 'linkedin', label: 'LinkedIn', href: SITE.sameAs[3] },
  { icon: 'email', label: 'Email', href: `mailto:${SITE.email}` },
] as const;

// Header 導覽；文章為下拉，固定 3 項策展清單（照原站，與 CATEGORIES 顯示名解耦）
export const HEADER_NAV = [
  { href: '/', label: '首頁' },
  { href: '/about/', label: '關於我' },
  { href: '/n8n-resources/', label: 'n8n 相關資源' },
  {
    href: '/articles/',
    label: '文章',
    children: [
      { href: '/category/n8n/', label: 'n8n 相關文章' },
      { href: '/category/flutter/', label: 'Flutter 開發' },
      { href: '/category/raspberry-pi/', label: 'Raspberry Pi' },
    ],
  },
  { href: '/contact-frank/', label: '聯絡我' },
] as const;

// Footer 兩欄策展連結（標籤沿用原站文字；分類/標籤連到實際頁面）
export const FOOTER_COLS = [
  [
    { href: '/category/n8n/', label: 'n8n 自動化' },
    { href: `/tag/${encodeURIComponent('模板')}/`, label: 'n8n 模板' },
    { href: '/category/devops/', label: 'WordPress 架站' },
    { href: '/category/flutter/', label: 'App 應用開發' },
  ],
  [
    { href: '/n8n-resources/', label: 'n8n 學習資源' },
    { href: '/about/', label: '關於我' },
    { href: '/contact-frank/', label: '聯絡我' },
    { href: '/privacy-policy/', label: '隱私權政策' },
  ],
] as const;
```

Step 3: 驗證型別與編譯
Run: `npx astro check 2>/dev/null || npm run build`
Expected: 無 TS 錯誤（build 進行到後續頁面）。本 task 單獨無法跑頁面，主要確認 site-meta 無語法/型別錯。

Step 4: Commit
Run: `git add src/utils/site-meta.ts && git commit -m "feat(site-meta): 加 SITE 顯示字串、SOCIAL/HEADER_NAV/FOOTER_COLS 單一來源"`

---

### Task 2: 新增 SocialIcons.astro

Implements: `site-pages.md` #R15, D14

Files:
- Create: `src/components/SocialIcons.astro`

Step 1: 建立檔案，內容如下（inline SVG 品牌圖示，由 `SOCIAL` 驅動；mailto 不開新分頁，其餘 `target=_blank`）：

```astro
---
import { SOCIAL } from '../utils/site-meta';

// 24x24 viewBox 的 path inner-markup（fill=currentColor）
const ICONS: Record<string, string> = {
  threads:
    '<path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.291 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.166 1.43 1.781 3.631 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L9.139 7.722c.97-1.44 2.547-2.232 4.445-2.232h.044c3.172.02 5.06 1.96 5.249 5.322.108.046.216.094.32.142 1.477.692 2.558 1.738 3.125 3.025.79 1.794.864 4.717-1.514 7.046-1.818 1.78-4.024 2.582-7.13 2.605Zm1.013-11.95c-.243 0-.49.007-.74.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.214-.242z"/>',
  instagram:
    '<path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>',
  github:
    '<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>',
  linkedin:
    '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/>',
  email:
    '<path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z"/><path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z"/>',
};
---

<ul class="social-icons">
  {SOCIAL.map((s) => {
    const isMail = s.href.startsWith('mailto:');
    return (
      <li>
        <a
          href={s.href}
          class="social-icon"
          aria-label={s.label}
          target={isMail ? undefined : '_blank'}
          rel={isMail ? undefined : 'noopener noreferrer'}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" set:html={ICONS[s.icon]} />
        </a>
      </li>
    );
  })}
</ul>

<style>
  .social-icons {
    display: flex;
    gap: 14px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .social-icon {
    display: inline-flex;
    color: var(--color-text-muted);
    transition: color 300ms steps(3);
  }

  .social-icon:hover {
    color: var(--color-text-primary);
  }
</style>
```

Step 2: 驗證
Run: `npm run build`
Expected: build 成功（此元件尚未被引用，但語法須過）。

Step 3: Commit
Run: `git add src/components/SocialIcons.astro && git commit -m "feat(footer): 加 SocialIcons 元件（inline SVG，由 SOCIAL 驅動）"`

---

### Task 3: 改寫 Nav.astro 為完整 header（高版＋收合＋下拉＋手機）

Implements: `site-pages.md` #R14, #R9, D12, D13

Files:
- Modify: `src/components/Nav.astro`（整檔覆寫）

Step 1: 將 `src/components/Nav.astro` 整檔覆寫為：

```astro
---
import { SITE, HEADER_NAV } from '../utils/site-meta';

const pathname = Astro.url.pathname;

function isActive(href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}
---

<div class="header-sentinel" id="header-sentinel" aria-hidden="true"></div>
<header class="site-header" id="site-header">
  <a href="/" class="header-brand">
    <img src="/logo.webp" alt="" class="header-avatar" width="56" height="56" />
    <span class="header-id">
      <span class="header-title">{SITE.title}</span>
      <span class="header-subtitle">{SITE.subtitle}</span>
    </span>
  </a>

  <button class="nav-hamburger" id="nav-hamburger" aria-label="選單" aria-expanded="false" type="button">
    <span></span><span></span><span></span>
  </button>

  <nav class="header-nav" id="header-nav">
    <ul class="nav-links">
      {HEADER_NAV.map((item) =>
        'children' in item && item.children ? (
          <li class="nav-item nav-item--dropdown">
            <div class="nav-parent">
              <a href={item.href} class:list={[{ 'nav-active': isActive(item.href) }]}>{item.label}</a>
              <button
                class="nav-caret"
                type="button"
                aria-haspopup="true"
                aria-expanded="false"
                aria-label={`展開${item.label}子選單`}
              >▾</button>
            </div>
            <ul class="nav-dropdown">
              {item.children.map((child) => (
                <li>
                  <a href={child.href} class:list={[{ 'nav-active': isActive(child.href) }]}>{child.label}</a>
                </li>
              ))}
            </ul>
          </li>
        ) : (
          <li class="nav-item">
            <a href={item.href} class:list={[{ 'nav-active': isActive(item.href) }]}>{item.label}</a>
          </li>
        )
      )}
    </ul>
  </nav>
</header>

<script>
  function initHeader() {
    const header = document.getElementById('site-header');
    const sentinel = document.getElementById('header-sentinel');
    const hamburger = document.getElementById('nav-hamburger');
    const nav = document.getElementById('header-nav');

    // 捲離頂部 → 收合成精簡 sticky bar
    if (header && sentinel && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        ([entry]) => header.classList.toggle('scrolled', !entry.isIntersecting),
        { threshold: 0 }
      );
      io.observe(sentinel);
    }

    // 手機漢堡
    if (hamburger && nav) {
      hamburger.addEventListener('click', () => {
        const open = nav.classList.toggle('header-nav--open');
        hamburger.setAttribute('aria-expanded', String(open));
      });
    }

    // 手機下拉 caret 切換
    document.querySelectorAll('.nav-caret').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const item = (btn as HTMLElement).closest('.nav-item--dropdown');
        if (!item) return;
        const open = item.classList.toggle('nav-item--open');
        btn.setAttribute('aria-expanded', String(open));
      });
    });
  }

  initHeader();
  document.addEventListener('astro:after-swap', initHeader);
</script>

<style>
  .header-sentinel {
    height: 1px;
  }

  .site-header {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 18px 24px;
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border-default);
    font-family: var(--font-sans);
    transition: padding 300ms steps(3);
  }

  /* 品牌（頭像＋標題＋副標） */
  .header-brand {
    display: flex;
    align-items: center;
    gap: 16px;
    text-decoration: none;
    color: var(--color-text-primary);
    min-width: 0;
  }

  .header-avatar {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-full);
    border: 1px solid var(--color-border-default);
    background: var(--color-bg-tertiary);
    flex-shrink: 0;
    object-fit: contain;
    transition: width 300ms steps(3), height 300ms steps(3);
  }

  .header-id {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .header-title {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.2;
  }

  .header-subtitle {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  /* nav */
  .nav-links {
    display: flex;
    align-items: center;
    gap: 24px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .nav-item {
    position: relative;
  }

  .nav-parent {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .nav-links a {
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: 15px;
    white-space: nowrap;
    transition: color 300ms steps(3);
  }

  .nav-links a:hover,
  .nav-links a.nav-active {
    color: var(--color-text-primary);
  }

  .nav-caret {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 12px;
    line-height: 1;
    padding: 0;
    cursor: pointer;
  }

  /* 下拉 */
  .nav-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    min-width: 180px;
    margin-top: 8px;
    padding: 8px 0;
    list-style: none;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    display: none;
    z-index: 110;
  }

  .nav-item--dropdown:hover .nav-dropdown,
  .nav-item--dropdown:focus-within .nav-dropdown {
    display: block;
  }

  .nav-dropdown a {
    display: block;
    padding: 8px 16px;
    font-size: 14px;
  }

  /* 收合（捲動後） */
  .site-header.scrolled {
    padding: 8px 24px;
  }

  .site-header.scrolled .header-avatar {
    width: 32px;
    height: 32px;
  }

  .site-header.scrolled .header-subtitle {
    display: none;
  }

  .site-header.scrolled .header-title {
    font-size: 16px;
  }

  /* 漢堡 */
  .nav-hamburger {
    display: none;
    flex-direction: column;
    gap: 5px;
    cursor: pointer;
    padding: 8px;
    background: none;
    border: none;
  }

  .nav-hamburger span {
    display: block;
    width: 22px;
    height: 2px;
    background: var(--color-text-primary);
  }

  /* 手機 */
  @media (max-width: 768px) {
    .header-subtitle {
      display: none;
    }

    .header-title {
      font-size: 16px;
    }

    .header-avatar {
      width: 40px;
      height: 40px;
    }

    .nav-hamburger {
      display: flex;
    }

    .header-nav {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--color-bg-secondary);
      border-bottom: 1px solid var(--color-border-default);
      padding: 16px 24px;
    }

    .header-nav.header-nav--open {
      display: block;
    }

    .nav-links {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }

    .nav-item,
    .nav-item--dropdown {
      width: 100%;
    }

    .nav-parent {
      width: 100%;
      justify-content: space-between;
    }

    /* 手機改用 caret 點擊展開，停用 hover/focus 自動展開 */
    .nav-item--dropdown:hover .nav-dropdown,
    .nav-item--dropdown:focus-within .nav-dropdown {
      display: none;
    }

    .nav-dropdown {
      position: static;
      min-width: 0;
      margin: 8px 0 0;
      padding: 0 0 0 16px;
      border: none;
      background: transparent;
      display: none;
    }

    .nav-item--open .nav-dropdown {
      display: block;
    }
  }
</style>
```

Step 2: 先型別檢查再 build（Nav 含 union narrowing，先 check 便於排查）
Run: `npx astro check 2>/dev/null || true; npm run build && grep -rl "site-header" dist/index.html`
Expected: build 成功；`dist/index.html` 命中 `site-header`。

Step 3: 確認 Nav 不再有舊的 GH/TH 文字連結殘留
Run: `grep -c "social-icon\">GH" dist/index.html || true`
Expected: 0（舊 header 社群文字已移除）。

Step 4: Commit
Run: `git add src/components/Nav.astro && git commit -m "feat(header): 改寫成高版 header＋捲動收合 sticky＋文章下拉＋手機漢堡"`

---

### Task 4: 改寫 Footer.astro（品牌＋描述＋社群＋兩欄＋copyright）

Implements: `site-pages.md` #R15, D14

Files:
- Modify: `src/components/Footer.astro`（整檔覆寫）

Step 1: 將 `src/components/Footer.astro` 整檔覆寫為：

```astro
---
import { SITE, FOOTER_COLS } from '../utils/site-meta';
import SocialIcons from './SocialIcons.astro';

const startYear = 2025;
const currentYear = new Date().getFullYear();
const yearLabel = currentYear > startYear ? `${startYear}–${currentYear}` : `${startYear}`;
---

<footer class="footer">
  <div class="footer-inner">
    <div class="footer-main">
      <div class="footer-brand">
        <img src="/logo.webp" alt="" class="footer-avatar" width="64" height="64" />
        <div class="footer-id">
          <div class="footer-title">{SITE.title}</div>
          <p class="footer-desc">{SITE.description}</p>
          <SocialIcons />
        </div>
      </div>

      <div class="footer-cols">
        {FOOTER_COLS.map((col) => (
          <ul class="footer-col">
            {col.map((link) => (
              <li><a href={link.href}>{link.label}</a></li>
            ))}
          </ul>
        ))}
      </div>
    </div>

    <div class="footer-bottom">
      <p class="footer-copyright">Copyright © {yearLabel} 法蘭克</p>
    </div>
  </div>
</footer>

<style>
  .footer {
    background: var(--color-bg-secondary);
    border-top: 1px solid var(--color-border-default);
    padding: 48px 0 24px;
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .footer-inner {
    max-width: var(--width-max);
    margin: 0 auto;
    padding: 0 24px;
  }

  .footer-main {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 48px;
  }

  .footer-brand {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .footer-avatar {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-full);
    border: 1px solid var(--color-border-default);
    background: var(--color-bg-tertiary);
    flex-shrink: 0;
    object-fit: contain;
  }

  .footer-id {
    min-width: 0;
  }

  .footer-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: 8px;
  }

  .footer-desc {
    color: var(--color-text-secondary);
    line-height: 1.7;
    margin: 0 0 16px;
    max-width: 420px;
  }

  .footer-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .footer-col {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .footer-col a {
    color: var(--color-text-secondary);
    text-decoration: none;
    transition: color 300ms steps(3);
  }

  .footer-col a:hover {
    color: var(--color-text-primary);
  }

  .footer-bottom {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid var(--color-border-subtle);
    text-align: center;
  }

  .footer-copyright {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-muted);
    letter-spacing: 0.02em;
  }

  @media (max-width: 768px) {
    .footer-main {
      grid-template-columns: 1fr;
      gap: 32px;
    }
  }
</style>
```

Step 2: 確認 build 通過且 footer 連結/社群輸出存在
Run: `npm run build && grep -o "social-icons" dist/index.html | head -1 && grep -o "footer-col" dist/index.html | head -1`
Expected: build 成功；命中 `social-icons` 與 `footer-col`。

Step 3: Commit
Run: `git add src/components/Footer.astro && git commit -m "feat(footer): 改寫成品牌＋描述＋社群＋兩欄連結＋copyright"`

---

### Task 5: 新增 tag/[tag].astro（個別標籤頁，全生）

Implements: `site-pages.md` #R16, D15

Files:
- Create: `src/pages/tag/[tag].astro`

備註：tag 含中文／空格／點／撇號（如「模板」、`Let's Encrypt`、`v0.dev`）。`getStaticPaths` 用原始 tag 字串當 param，Astro 會輸出 UTF-8 目錄、`Astro.params.tag` 取回為解碼值；連結端用 `encodeURIComponent`（見 Task 1 footer、Task 6 標籤雲）。CF Pages 對 UTF-8 路徑可正確 serve。

Step 1: 建立檔案：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import ArticleTimeline from '../../components/ArticleTimeline.astro';
import { getCollection, type CollectionEntry } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const tagSet = new Set<string>();
  for (const p of posts) for (const t of p.data.tags) tagSet.add(t);
  return [...tagSet].map((tag) => ({
    params: { tag },
    props: { tag, tagPosts: posts.filter((p) => p.data.tags.includes(tag)) },
  }));
}

interface Props {
  tag: string;
  tagPosts: CollectionEntry<'posts'>[];
}

const { tag, tagPosts } = Astro.props;
---

<BaseLayout
  title={`標籤：${tag} - 下班後的工程師筆記`}
  description={`所有標記「${tag}」的技術文章。`}
>
  <main class="list-page">
    <header class="list-head">
      <h1 class="list-title">標籤：{tag}</h1>
      <p class="list-sub">共 {tagPosts.length} 篇</p>
      <a class="list-back" href="/tag/">← 所有標籤</a>
    </header>

    <ArticleTimeline posts={tagPosts} />
  </main>
</BaseLayout>

<style>
  .list-back {
    display: inline-block;
    margin-top: 12px;
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--color-text-secondary);
    text-decoration: none;
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }

  .list-back:hover {
    border-bottom-color: var(--color-brand-orange);
    background-color: rgba(251, 146, 60, 0.1);
  }
</style>
```

Step 2: 確認 tag 頁有被產出（含中文 tag）
Run: `npm run build && ls dist/tag/ && test -f "dist/tag/模板/index.html" && echo "模板 OK"`
Expected: build 成功；`dist/tag/` 下有多個 tag 目錄；`dist/tag/模板/index.html` 存在、印出「模板 OK」。

Step 3: Commit
Run: `git add src/pages/tag/\[tag\].astro && git commit -m "feat(tag): 加 /tag/[tag]/ 個別標籤時間軸頁（全生）"`

---

### Task 6: 新增 tag/index.astro（/tag/ 標籤雲總覽）

Implements: `site-pages.md` #R16, D15

Files:
- Create: `src/pages/tag/index.astro`

Step 1: 建立檔案：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getCollection } from 'astro:content';

const posts = await getCollection('posts', ({ data }) => !data.draft);
const counts = new Map<string, number>();
for (const p of posts) for (const t of p.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);

// 字級分級：依篇數決定 tier
function tier(count: number): 'sm' | 'md' | 'lg' | 'xl' {
  if (count >= 5) return 'xl';
  if (count >= 3) return 'lg';
  if (count >= 2) return 'md';
  return 'sm';
}

const tags = [...counts.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([name, count]) => ({
    name,
    count,
    tier: tier(count),
    href: `/tag/${encodeURIComponent(name)}/`,
  }));
---

<BaseLayout
  title="標籤 - 下班後的工程師筆記"
  description="以標籤雲瀏覽所有技術文章標籤。"
>
  <main class="list-page">
    <header class="list-head">
      <h1 class="list-title">標籤</h1>
      <p class="list-sub">共 {tags.length} 個標籤</p>
    </header>

    <div class="tag-cloud">
      {tags.map((t) => (
        <a class:list={['tag-cloud-item', `tag-cloud-item--${t.tier}`]} href={t.href}>
          {t.name}<span class="tag-cloud-count">{t.count}</span>
        </a>
      ))}
    </div>
  </main>
</BaseLayout>

<style>
  .tag-cloud {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 12px 16px;
  }

  .tag-cloud-item {
    font-family: var(--font-sans);
    color: var(--color-text-secondary);
    text-decoration: none;
    line-height: 1.3;
    border-bottom: 2px solid rgba(251, 146, 60, 0.3);
    transition: color 300ms steps(3), border-color 300ms steps(3), background-color 300ms steps(3);
  }

  .tag-cloud-item:hover {
    color: var(--color-text-primary);
    border-bottom-color: var(--color-brand-orange);
    background-color: rgba(251, 146, 60, 0.1);
  }

  .tag-cloud-count {
    font-family: var(--font-mono);
    font-size: 0.6em;
    color: var(--color-text-muted);
    margin-left: 4px;
    vertical-align: super;
  }

  .tag-cloud-item--sm { font-size: 14px; }
  .tag-cloud-item--md { font-size: 18px; }
  .tag-cloud-item--lg { font-size: 24px; }
  .tag-cloud-item--xl { font-size: 30px; }
</style>
```

Step 2: 確認 /tag/ 總覽產出且含文字雲
Run: `npm run build && test -f dist/tag/index.html && grep -o "tag-cloud" dist/tag/index.html | head -1`
Expected: build 成功；`dist/tag/index.html` 存在、命中 `tag-cloud`。

Step 3: Commit
Run: `git add src/pages/tag/index.astro && git commit -m "feat(tag): 加 /tag/ 標籤雲總覽頁（字級依篇數）"`

---

### Task 7: 新增 n8n-resources.astro（最小 stub）

Implements: `site-pages.md` #R17, #R9, D17

Files:
- Create: `src/pages/n8n-resources.astro`

Step 1: 建立檔案：

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout
  title="n8n 相關資源 - 下班後的工程師筆記"
  description="n8n 教學文章、模板分享與學習資源整理。"
>
  <main class="list-page">
    <header class="list-head">
      <h1 class="list-title">n8n 相關資源</h1>
      <p class="list-sub">教學文章、模板分享、外部資源</p>
    </header>

    <div class="prose">
      <p>整理自己實戰過的 n8n 內容，包含教學文章、自動化模板，以及參考過的學習資源。完整資源整理持續更新中。</p>
      <ul>
        <li><a href="/category/n8n/">n8n 相關文章</a></li>
        <li><a href={`/tag/${encodeURIComponent('模板')}/`}>n8n 自動化模板</a></li>
      </ul>
    </div>
  </main>
</BaseLayout>
```

Step 2: 確認頁面產出
Run: `npm run build && test -f dist/n8n-resources/index.html && echo "n8n-resources OK"`
Expected: build 成功；印出「n8n-resources OK」。

Step 3: Commit
Run: `git add src/pages/n8n-resources.astro && git commit -m "feat(pages): 加 /n8n-resources/ 最小占位頁（完整策展頁另案）"`

---

### Task 8: 整合驗證（build 全綠＋無死連結＋Chrome 抽驗）

Implements: `site-pages.md` #R9, #R14, #R15, #R16, #R17

Files:
- 無（純驗證）

Step 1: 全量 build
Run: `npm run build`
Expected: 成功，無錯誤／警告。

Step 2: 死連結靜態核對 — 確認 header/footer 連到的頁面都有對應產出
Run:
```bash
# 首頁輸出在 dist/index.html（無子目錄），單獨檢查
test -f "dist/index.html" && echo "OK  index" || echo "MISS index"
for p in about articles contact-frank privacy-policy category n8n-resources \
         category/n8n category/devops category/flutter category/raspberry-pi tag; do
  test -f "dist/$p/index.html" && echo "OK  $p" || echo "MISS $p"
done
test -f "dist/tag/模板/index.html" && echo "OK  tag/模板" || echo "MISS tag/模板"
```
Expected: 全部 `OK`，無 `MISS`。

Step 3: 確認 header/footer 在所有頁面一致渲染（抽兩頁）
Run: `grep -l "site-header" dist/index.html dist/about/index.html && grep -l "footer-copyright" dist/index.html dist/about/index.html`
Expected: 兩頁都命中。

Step 4: Chrome 本機抽驗（dev server）
Run: `npm run dev`（背景），用 Chrome 開 `http://localhost:4321/` 逐項確認：
- 桌機高版 header（頭像/標題/副標/nav）→ 向下捲 → 收合成精簡 sticky bar（小 logo、副標隱藏、nav 仍在）
- hover「文章」展開 3 項（n8n 相關文章／Flutter 開發／Raspberry Pi），點擊到對應 `/category/...`
- 縮到 ≤768px → 漢堡展開直列；點文章 caret 展開子項
- footer：5 個社群圖示顯示且連結正確（threads/ig/github/linkedin/mailto）、兩欄連結全可點、copyright 顯示 `2025–2026 法蘭克`
- `/tag/` 文字雲（字級有大小差異）、點「模板」→ `/tag/模板/` 時間軸＋「← 所有標籤」回鏈
- `/n8n-resources/` 占位頁正常
Expected: 全部符合；無 console error。

Step 5: 收尾 commit（若 Chrome 抽驗有微調才需要；純驗證無改動則略過）
Run: `git status`
Expected: working tree clean（前面 task 已逐一 commit）。
