# RSS 內文圖修復（Container API）Implementation Plan

Goal: 修 RSS feed 內文圖 404——改用 Astro Container API 渲染文章 Content，讓內文圖循 image pipeline 解析為 `/_astro/<hash>.webp` 再改寫絕對 URL。

Architecture: 單檔重寫 `src/pages/rss.xml.ts`，渲染引擎由 markdown-it 換成 `render(post)` + `experimental_AstroContainer.renderToString(Content)`；絕對化 regex 簡化為單一「`/` 開頭 → 前綴 SITE.url」分支；移除 markdown-it 依賴。

Tech Stack: Astro 5 experimental Container API（`astro/container`、`astro:container`、`astro:content` 的 `render`）、sanitize-html、@astrojs/rss。

Spec: `docs/specs/pre-launch-infra.md`（Pending Changes：MODIFIED R5 / ADDED S10 / ADDED D9）

驗證說明：repo 無 unit-test runner 適用於 Astro endpoint，本計畫以 `npm run build` 產物（`dist/rss.xml` 與 `dist/_astro/`）作為驗收依據。

---

### Task 1: 重寫 rss.xml.ts 改用 Container API

Implements: `pre-launch-infra.md` #R5, #D9

Files:
- Modify: `src/pages/rss.xml.ts`（整檔取代）

Step 1: 將 `src/pages/rss.xml.ts` 整檔內容取代為下列程式碼

```ts
import type { APIContext } from 'astro';
import rss from '@astrojs/rss';
import { getCollection, render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import sanitizeHtml from 'sanitize-html';
import { SITE } from '../utils/site-meta';

export async function GET(context: APIContext) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 20);

  // 純 markdown 內容不需 framework renderer
  const renderers = await loadRenderers([]);
  const container = await AstroContainer.create({ renderers });

  const items = await Promise.all(
    posts.map(async (p) => {
      // 渲染真正的 Content，內文圖循 image pipeline 解析為 /_astro/<hash>.webp
      const { Content } = await render(p);
      let html = await container.renderToString(Content);
      // Content render 後 img src 與內連 href 皆 root-relative（/_astro/...、/<slug>/），改寫為絕對 URL
      html = html.replace(
        /(src|href)="(\/[^"]*)"/g,
        (_m, attr, path) => `${attr}="${SITE.url}${path}"`,
      );
      const safe = sanitizeHtml(html, {
        allowedTags: ['img', 'a', 'h2', 'h3', 'h4', 'h5', 'p', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'strong', 'em', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
        allowedAttributes: {
          a: ['href', 'title'],
          img: ['src', 'alt', 'title'],
          code: ['class'],
          pre: ['class'],
        },
      });
      return {
        title: p.data.title,
        pubDate: p.data.date,
        description: p.data.description,
        link: `/${p.id}/`,
        categories: [p.data.category, ...(p.data.tags ?? [])],
        content: safe,
      };
    }),
  );

  return rss({
    title: SITE.name,
    description: SITE.tagline,
    site: context.site ?? SITE.url,
    customData: '<language>zh-TW</language>',
    items,
  });
}
```

變更要點（相對原檔）：
- 移除 `import MarkdownIt from 'markdown-it'` 與 `const md = new MarkdownIt(...)`。
- 新增 `render`（from astro:content）、`AstroContainer`、`loadRenderers` import。
- `posts.map` 改為 async + `Promise.all`，因 `render` / `renderToString` 為非同步。
- 渲染由 `md.render(p.body)` 改為 `container.renderToString(Content)`。
- 絕對化 regex 由原本雙分支（`/` 開頭與 per-post 相對拼接）簡化為單一 `/` 開頭分支。
- sanitizeHtml 白名單與 rss() 其餘欄位維持不變。

Step 2: 跑 build 確認編譯通過且無型別/import 錯誤
Run: `npm run build`
Expected: PASS，輸出 `[build] Complete!`、`dist/rss.xml` 產出。

Step 3: Commit
Run: `git add src/pages/rss.xml.ts && git commit -m "fix(rss): 改用 Container API 渲染內文，解內文圖 404"`

---

### Task 2: 移除 markdown-it 依賴

Implements: `pre-launch-infra.md` #D9

Files:
- Modify: `package.json`（移除 `markdown-it`、`@types/markdown-it`）
- Modify: `package-lock.json`（npm 自動更新）

Step 1: 移除兩個依賴
Run: `npm remove markdown-it @types/markdown-it`
Expected: 成功移除，`package.json` 的 dependencies 不再有 `markdown-it`、devDependencies 不再有 `@types/markdown-it`。

Step 2: 確認無殘留引用
Run: `grep -rn "markdown-it\|MarkdownIt" src/ scripts/`
Expected: 無輸出（Task 1 已移除唯一引用）。

Step 3: 跑 build 確認移除後仍正常
Run: `npm run build`
Expected: PASS，`[build] Complete!`。

Step 4: Commit
Run: `git add package.json package-lock.json && git commit -m "chore: 移除不再使用的 markdown-it 依賴"`

---

### Task 3: 驗收 RSS 內文圖指向最佳化資源

Implements: `pre-launch-infra.md` #R5, #S10

Files:
- 無檔案變更（純驗收）

Step 1: 確保已 build（若未跑過）
Run: `npm run build`
Expected: PASS。

Step 2: 檢查 RSS 內文圖 src 已指向 `/_astro/`，且不再有舊的 `/<slug>/./images/` 路徑
Run: `grep -oE 'src=&quot;https://frankchen.tw/_astro/[^&]+&quot;' dist/rss.xml | head -5; echo "--- 舊壞路徑數（應為 0）---"; grep -c 'images/' dist/rss.xml`
Expected: 列出數筆 `https://frankchen.tw/_astro/<hash>.webp` 形式的 img src；`images/` 計數為 0。

Step 3: 抽驗一張 RSS 圖片檔案實際存在於 dist
Run: `f=$(grep -oE '/_astro/[A-Za-z0-9._-]+\.webp' dist/rss.xml | head -1); echo "檢查: $f"; test -f "dist$f" && echo "EXISTS" || echo "MISSING"`
Expected: 印出 `EXISTS`。

Step 4: 確認內連 href 仍為絕對 URL、未殘留相對內連
Run: `grep -oE 'href=&quot;https://frankchen.tw/[a-z0-9-]+/&quot;' dist/rss.xml | head -3`
Expected: 列出數筆絕對內連 URL（如 `https://frankchen.tw/wordpress-migrate-to-zeabur/`）。

Step 5: 標記 spec scenario 完成（在 dev:finish 階段一併把 Pending Changes 併入主體、status 升 active）
此步無指令，作為收尾提醒：S10 驗收通過。
```
