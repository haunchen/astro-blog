import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import { CATEGORY_LABEL, SITE } from '../../utils/site-meta';

const notoSansTC = await fs.readFile('src/assets/og-fonts/noto-sans-tc-subset.woff');
const inter = await fs.readFile('src/assets/og-fonts/inter-bold.woff');

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
};

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: any };
  const title = post.data.title as string;
  const category = CATEGORY_LABEL[post.data.category] ?? post.data.category;

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          backgroundColor: '#0f172a',
          color: '#E2E8F0',
          fontFamily: 'Noto Sans TC, Inter, sans-serif',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignSelf: 'flex-start',
                padding: '8px 20px',
                backgroundColor: '#fb923c',
                color: '#0f172a',
                borderRadius: '999px',
                fontSize: '28px',
                fontWeight: 700,
              },
              children: category,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '64px',
                fontWeight: 700,
                lineHeight: 1.3,
                color: '#F8FAFC',
                display: 'flex',
              },
              children: title,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                borderTop: '2px solid #334155',
                paddingTop: '24px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { fontSize: '28px', color: '#F8FAFC', fontWeight: 700 },
                    children: SITE.name,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { fontSize: '22px', color: '#94A3B8' },
                    children: 'frankchen.tw',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Noto Sans TC', data: notoSansTC, weight: 700, style: 'normal' },
        { name: 'Inter', data: inter, weight: 700, style: 'normal' },
      ],
    }
  );

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
