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

test('wp:code 含泛型角括號不被當 HTML 標籤破壞', () => {
  const html = `<!-- wp:code {"language":"dart"} --><pre class="wp-block-code"><code lang="dart" class="language-dart">class A extends State<AuthScreen> {
  Future<void> foo() async {}
}</code></pre><!-- /wp:code -->`;
  const md = htmlToMarkdown(html);
  assert.match(md, /```dart/);
  assert.match(md, /State<AuthScreen>/);   // 大小寫保留、無小寫化
  assert.match(md, /Future<void>/);
  assert.doesNotMatch(md, /<\/authscreen>|<authscreen>/); // 無殘留/小寫化標籤（case-sensitive）
});

test('wp:code entity 編碼版本 htmlDecode 後得到正確角括號', () => {
  const html = `<!-- wp:code {"language":"dart"} --><pre class="wp-block-code"><code lang="dart" class="language-dart">class A extends State&lt;AuthScreen&gt; {
  Future&lt;void&gt; foo() async {}
}</code></pre><!-- /wp:code -->`;
  const md = htmlToMarkdown(html);
  assert.match(md, /```dart/);
  assert.match(md, /State<AuthScreen>/);
  assert.match(md, /Future<void>/);
  assert.doesNotMatch(md, /<\/authscreen>|<authscreen>/); // case-sensitive
});

test('code-block-pro 轉乾淨 fenced block（entity 解碼、無孤立語言標籤、無 shiki 殘留、不重複）', () => {
  const html = `<!-- wp:kevinbatdorf/code-block-pro {"code":"echo a &amp;&amp; echo b","language":"bash"} -->
<div class="wp-block-kevinbatdorf-code-block-pro"><span>Bash</span><span class="code-block-pro-copy-button"><pre><textarea>echo a &amp;&amp; echo b</textarea></pre></span><pre class="shiki"><code><span class="line"><span>echo a</span></span></code></pre></div>
<!-- /wp:kevinbatdorf/code-block-pro -->`;
  const md = htmlToMarkdown(html);
  // 含正確解碼後的 fenced block
  assert.match(md, /```bash\necho a && echo b\n```/);
  // 不含孤立的語言標籤行
  assert.doesNotMatch(md, /^Bash$/m);
  // 不含 shiki 字樣
  assert.doesNotMatch(md, /shiki/);
  // echo 只出現一次（不重複）
  const echoCount = (md.match(/echo a/g) || []).length;
  assert.equal(echoCount, 1);
});
