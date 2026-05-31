#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'src/content/posts');
const OUT = path.join(ROOT, 'docs/data/migration-manifest.json');

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let [, k, v] = kv;
    v = v.trim().replace(/^"(.*)"$/, '$1');
    // parse JSON arrays (tags: ["a", "b"])
    if (v.startsWith('[')) {
      try {
        fm[k] = JSON.parse(v);
        continue;
      } catch {}
    }
    fm[k] = v;
  }
  return fm;
}

const entries = await readdir(POSTS_DIR, { withFileTypes: true });
const manifest = [];
for (const e of entries) {
  if (!e.isDirectory()) continue;
  if (e.name === 'test-markdown-rendering') continue;
  const dir = path.join(POSTS_DIR, e.name);
  const md = await readFile(path.join(dir, 'index.md'), 'utf-8');
  const fm = parseFrontmatter(md);
  let images = [];
  try {
    images = (await readdir(path.join(dir, 'images'))).filter((f) => f.endsWith('.webp'));
  } catch {}
  manifest.push({
    slug: e.name,
    title: fm.title ?? '',
    description: fm.description ?? '',
    category: fm.category ?? '',
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    images,
  });
}

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`manifest 寫出 ${manifest.length} 篇 -> ${OUT}`);
