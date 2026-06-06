# RSS 內文圖片修復設計（Container API）

- 日期：2026-06-06
- Domain：pre-launch-infra（R5 / D3）
- 分支：feat/rss-container-images
- 對應 Issue：#2 第一項（RSS body images 路徑改寫到不存在位置）

## 問題

`src/pages/rss.xml.ts` 用 markdown-it 渲染 `post.body`，再用 regex 把相對圖片路徑
（`./images/cover.webp`）拼成 `${SITE.url}/${p.id}/${p2}`，得到
`https://frankchen.tw/<slug>/./images/<file>.webp`。

但文章內文圖是 content collection 的相對資源，`astro build` 會經 image pipeline
改名搬到 `/_astro/<hash>.webp`，slug 目錄底下只剩 `index.html`，沒有 `images/` 子目錄。
兩者對不上 → RSS reader 抓內文圖一律 404。

實測（2026-06-06，35 篇已匯入 main）已確認成立：
- `dist/rss.xml` 內 img src = `https://frankchen.tw/cloudflare-cache-rules-wordpress/./images/...webp`
- `dist/<slug>/images/` 不存在；圖實際在 `dist/_astro/`

根因：markdown-it 不認得 content collection 的相對圖片，不會觸發 image pipeline。

## 方案：Astro Container API 渲染文章 Content

換掉 markdown-it，改用 `render(post)` 取得文章的 `<Content/>` 元件，
再用 experimental Container API `renderToString()` 渲染成 HTML 字串。
此路徑走真正的 image pipeline，內文圖會解析成 root-relative 的 `/_astro/<hash>.webp`，
再前綴 `SITE.url` 即為可正確抓取的絕對 URL。

純 markdown（無 MDX）時 `loadRenderers([])` 空陣列即可，不需 framework renderer。

依據：
- Astro Container reference：https://docs.astro.build/en/reference/container-reference/
- 官方範例 delucis/astro-blog-full-text-rss

## 實作（單檔 `src/pages/rss.xml.ts`）

```ts
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

  const renderers = await loadRenderers([]);
  const container = await AstroContainer.create({ renderers });

  const items = await Promise.all(posts.map(async (p) => {
    const { Content } = await render(p);
    let html = await container.renderToString(Content);
    // Content render 後內文圖為 /_astro/...、內連為 /<slug>/，皆 root-relative
    html = html.replace(/(src|href)="(\/[^"]*)"/g, (_m, attr, path) => `${attr}="${SITE.url}${path}"`);
    const safe = sanitizeHtml(html, { /* 維持現有白名單 */ });
    return {
      title: p.data.title, pubDate: p.data.date, description: p.data.description,
      link: `/${p.id}/`, categories: [p.data.category, ...(p.data.tags ?? [])], content: safe,
    };
  }));

  return rss({ title: SITE.name, description: SITE.tagline, site: context.site ?? SITE.url,
               customData: '<language>zh-TW</language>', items });
}
```

## 決策

- D-a：絕對化 regex 簡化為單一「`/` 開頭 → 前綴 SITE.url」分支。Content render 後不再出現
  per-post 相對路徑，舊的 `${SITE.url}/${p.id}/${p2}` 分支移除。
- D-b：移除 `markdown-it` 與 `@types/markdown-it` 依賴（全 repo 僅 rss.xml.ts 使用）。
- D-c：fail-loud。任一篇 render 失敗即讓 `npm run build` 報錯，不降級成摘要；
  破文章在 build 期被抓到，不默默出貨破 feed。
- D-d：範圍僅修內文圖 404。cover（frontmatter）維持不進 RSS body，不擴範圍。
- D-e：sanitizeHtml 維持現有 allowedTags / allowedAttributes；Shiki inline style 仍被剝
  （RSS 程式碼不上色），與現況一致。

## 驗收

1. `npm run build` 成功（38 頁）。
2. `dist/rss.xml` 內文圖 src 指向 `https://frankchen.tw/_astro/<hash>.webp`。
3. 對應 `dist/_astro/<hash>.webp` 檔案實際存在。
4. 內連 src/href 仍為絕對 URL、sanitize 後標籤白名單不變。
```
