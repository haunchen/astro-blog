import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1).max(60, '標題不可超過 60 字（SEO 限制）'),
      date: z.date(),
      updated: z.date().optional(),
      description: z.string().max(160, '描述不可超過 160 字（SEO 限制）'),
      category: z.enum(['n8n', 'flutter', 'devops', 'raspberry-pi', 'tools', 'hardware']),
      tags: z.array(z.string()).default([]),
      cover: image(),
      draft: z.boolean().default(false),
      // 排程發布日。有值且 draft 為真時，publish-scheduled 到期會把 draft 翻掉並把
      // date 改寫成這個值。沒有這個欄位的草稿永遠不會被自動發布。
      // z.coerce 與上面的 date 一致，讓 YAML 的裸日期字串也能過。
      publishAt: z.coerce.date().optional(),
    }),
});

export const collections = { posts };
