import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToMarkdown } from './html-to-md.mjs';

test('清除 wp 註解', () => {
  const md = htmlToMarkdown('<!-- wp:paragraph --><p>嗨</p><!-- /wp:paragraph -->');
  assert.equal(md.trim(), '嗨');
});

test('h2/h3 轉 ##/###', () => {
  const md = htmlToMarkdown('<h2 class="wp-block-heading">前言</h2><h3>小節</h3>');
  assert.match(md, /^## 前言/m);
  assert.match(md, /^### 小節/m);
});

test('pre/code 轉 fenced block', () => {
  const md = htmlToMarkdown('<pre class="wp-block-code"><code>npm install</code></pre>');
  assert.match(md, /```\n?npm install\n?```/);
});

test('img 轉 markdown 並保留原 URL，figcaption 當 alt', () => {
  const html = '<figure class="wp-block-image"><img src="https://www.frankchen.tw/wp-content/uploads/a.png" alt=""/><figcaption>憑證流程</figcaption></figure>';
  const md = htmlToMarkdown(html);
  assert.match(md, /!\[憑證流程\]\(https:\/\/www\.frankchen\.tw\/wp-content\/uploads\/a\.png\)/);
});

test('連結與粗體正常', () => {
  const md = htmlToMarkdown('<p>看 <a href="https://x.com">這裡</a> 與 <strong>重點</strong></p>');
  assert.match(md, /\[這裡\]\(https:\/\/x\.com\)/);
  assert.match(md, /\*\*重點\*\*/);
});
