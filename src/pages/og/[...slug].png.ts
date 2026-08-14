import type { APIRoute, GetStaticPaths } from 'astro';
import { ogRouteSlug } from '../../../scripts/lib/og-image.mjs';
import { getOgImage } from '../../utils/og';
import { getPublishedPosts } from '../../utils/posts';
import type { Post } from '../../utils/posts';

/**
 * 文章的 OG 圖。渲染與雜湊在 scripts/lib/og-image.mjs，接線與快取在 src/utils/og.ts——
 * 這個端點只負責把「已經算好的那張圖」放到它的雜湊網址上。
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getPublishedPosts();
  return Promise.all(
    posts.map(async (post) => {
      const { hash } = await getOgImage(post);
      return { params: { slug: ogRouteSlug(post.id, hash) }, props: { post } };
    }),
  );
};

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: Post };
  // getStaticPaths 已經渲染過同一篇，這裡命中快取，不會再渲染一次。
  const { bytes } = await getOgImage(post);
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png' } });
};
