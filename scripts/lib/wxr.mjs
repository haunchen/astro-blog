import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '__cdata',
  trimValues: false,
});

function text(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (node.__cdata != null) return String(node.__cdata);
  if (node['#text'] != null) return String(node['#text']);
  return '';
}

function asArray(x) {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

export function parseWxr(xml) {
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel ?? {};
  const items = asArray(channel.item);

  const attachments = {};
  for (const it of items) {
    if (text(it['wp:post_type']) !== 'attachment') continue;
    const id = text(it['wp:post_id']);
    const url = text(it['wp:attachment_url']);
    if (id && url) attachments[id] = url;
  }

  const posts = [];
  for (const it of items) {
    if (text(it['wp:post_type']) !== 'post') continue;
    if (text(it['wp:status']) !== 'publish') continue;

    const cats = asArray(it.category);
    const categoryNode = cats.find((c) => c['@_domain'] === 'category');
    const tags = cats
      .filter((c) => c['@_domain'] === 'post_tag')
      .map((c) => text(c))
      .filter(Boolean);

    const metas = asArray(it['wp:postmeta']);
    const thumbMeta = metas.find((m) => text(m['wp:meta_key']) === '_thumbnail_id');

    posts.push({
      title: text(it.title).trim(),
      slug: text(it['wp:post_name']).trim(),
      pubDate: text(it.pubDate).trim(),
      status: text(it['wp:status']),
      excerpt: text(it['excerpt:encoded']).trim(),
      contentHtml: text(it['content:encoded']),
      categoryNicename: categoryNode ? (categoryNode['@_nicename'] ?? '') : '',
      tags,
      thumbnailId: thumbMeta ? text(thumbMeta['wp:meta_value']).trim() : null,
    });
  }

  return { posts, attachments };
}
