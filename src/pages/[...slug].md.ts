import type { APIRoute, GetStaticPaths } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { SITE } from '../utils/site-meta';
import { getPublishedPosts } from '../utils/posts';
import {
  buildImageUrlMap,
  rewriteImagePaths,
  toYamlFrontmatter,
} from '../../scripts/lib/md-export.mjs';

/**
 * 文章的 markdown 變體，給 AI agent 直接取用（見 docs/specs/agent-markdown.md）。
 *
 * 正文原樣輸出，只改寫圖片路徑——程式碼區塊、表格、標題階層都保持原始 markdown，
 * 這正是「原生 md」相對於通用 HTML→MD 轉換器的品質優勢。
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
};

// container 建一次就好：35 條路徑共用，逐篇重建只是重複付出載入 renderer 的成本。
let containerPromise: Promise<AstroContainer> | undefined;
function getContainer(): Promise<AstroContainer> {
  return (containerPromise ??= loadRenderers([]).then((renderers) => AstroContainer.create({ renderers })));
}

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: CollectionEntry<'posts'> };

  // 渲染真正的 <Content/>：內文圖經 image pipeline 解析為 /_astro/<雜湊>.webp，
  // 這是唯一拿得到「實際會被部署的那個圖片網址」的途徑（見 md-export.mjs 檔頭）。
  const { Content } = await render(post);
  const container = await getContainer();
  const html = await container.renderToString(Content);

  const body = rewriteImagePaths(post.body ?? '', buildImageUrlMap(html), SITE.url);

  // 白名單：draft 等內部欄位不輸出。image 用 OG 圖而非文章封面——CF 的規格本就
  // 從 og:image 抽這個欄位，且封面在文章頁是四尺寸 srcset，要複製那套解析得多接
  // 一層 image service 呼叫，OG 圖則是固定路徑。
  const frontmatter = toYamlFrontmatter({
    title: post.data.title,
    description: post.data.description,
    date: post.data.date,
    updated: post.data.updated,
    category: post.data.category,
    tags: post.data.tags,
    canonical: `${SITE.url}/${post.id}/`,
    image: `${SITE.url}/og/${post.id}.png`,
  });

  return new Response(`${frontmatter}\n\n${body}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
