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
    }),
});

export const collections = { posts };
