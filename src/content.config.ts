import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.date(),
      updated: z.date().optional(),
      description: z.string(),
      category: z.enum(['n8n', 'flutter', 'devops', 'raspberry-pi', 'tools']),
      tags: z.array(z.string()).default([]),
      cover: image(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { posts };
