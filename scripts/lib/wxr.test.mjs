import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWxr } from './wxr.mjs';

const SAMPLE = `<?xml version="1.0"?><rss><channel>
<item>
  <title><![CDATA[Hello SSL]]></title>
  <link>https://www.frankchen.tw/hello-ssl/</link>
  <pubDate>Wed, 28 May 2025 02:22:20 +0000</pubDate>
  <wp:post_id>10</wp:post_id>
  <wp:post_name><![CDATA[hello-ssl]]></wp:post_name>
  <wp:status><![CDATA[publish]]></wp:status>
  <wp:post_type><![CDATA[post]]></wp:post_type>
  <excerpt:encoded><![CDATA[摘要文字]]></excerpt:encoded>
  <content:encoded><![CDATA[<p>內文</p>]]></content:encoded>
  <category domain="category" nicename="n8n"><![CDATA[n8n]]></category>
  <category domain="post_tag" nicename="ssl"><![CDATA[SSL]]></category>
  <wp:postmeta><wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key><wp:meta_value><![CDATA[99]]></wp:meta_value></wp:postmeta>
</item>
<item>
  <title><![CDATA[草稿不要]]></title>
  <wp:post_name><![CDATA[draft-x]]></wp:post_name>
  <wp:status><![CDATA[draft]]></wp:status>
  <wp:post_type><![CDATA[post]]></wp:post_type>
  <content:encoded><![CDATA[x]]></content:encoded>
</item>
<item>
  <title><![CDATA[圖片]]></title>
  <wp:post_id>99</wp:post_id>
  <wp:status><![CDATA[inherit]]></wp:status>
  <wp:post_type><![CDATA[attachment]]></wp:post_type>
  <wp:attachment_url>https://www.frankchen.tw/wp-content/uploads/x.png</wp:attachment_url>
</item>
</channel></rss>`;

test('parseWxr 只回傳 post+publish', () => {
  const { posts } = parseWxr(SAMPLE);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].slug, 'hello-ssl');
  assert.equal(posts[0].title, 'Hello SSL');
  assert.equal(posts[0].status, 'publish');
});

test('parseWxr 抽出 category/tags/thumbnailId/excerpt/content', () => {
  const { posts } = parseWxr(SAMPLE);
  const p = posts[0];
  assert.equal(p.categoryNicename, 'n8n');
  assert.deepEqual(p.tags, ['SSL']);
  assert.equal(p.thumbnailId, '99');
  assert.equal(p.excerpt, '摘要文字');
  assert.match(p.contentHtml, /內文/);
  assert.equal(p.pubDate, 'Wed, 28 May 2025 02:22:20 +0000');
});

test('parseWxr 建 attachment id→url map', () => {
  const { attachments } = parseWxr(SAMPLE);
  assert.equal(attachments['99'], 'https://www.frankchen.tw/wp-content/uploads/x.png');
});
