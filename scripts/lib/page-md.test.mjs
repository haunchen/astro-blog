import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMainContent, buildPageMarkdown } from './page-md.mjs';

const ORIGIN = 'https://frankchen.tw';

/** 模擬 BaseLayout 的最小骨架：nav / footer 是 #main-content 的兄弟節點。 */
function page({ title = '關於我 - Frank Chen', description = '這是描述', body = '<p>內文</p>' } = {}) {
  return `<!DOCTYPE html><html lang="zh-TW"><head>
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="https://frankchen.tw/about/">
<meta property="og:image" content="https://frankchen.tw/cover.webp">
</head><body>
<nav><a href="/">首頁</a></nav>
<div id="main-content" tabindex="-1">${body}</div>
<footer><p>版權宣告</p></footer>
</body></html>`;
}

test('extractMainContent：只取 #main-content，排除 nav 與 footer', () => {
  const main = extractMainContent(page());
  assert.equal(main, '<p>內文</p>');
});

// 非貪婪 regex 會在第一個 </div> 收尾，抽到的內容被無聲截斷——這條是主防線。
test('extractMainContent：巢狀 div 靠深度計數正確配對', () => {
  const body = '<div class="a"><div class="b"><p>深層</p></div></div><p>尾段</p>';
  const main = extractMainContent(page({ body }));
  assert.equal(main, body);
  assert.ok(main.includes('尾段'));
});

test('extractMainContent：找不到主內容區時回 null', () => {
  assert.equal(extractMainContent('<html><body><p>沒有容器</p></body></html>'), null);
});

test('buildPageMarkdown：frontmatter 為四欄非文章契約', () => {
  const md = buildPageMarkdown(page(), ORIGIN);
  assert.ok(md.startsWith('---\n'));
  assert.match(md, /^title: "關於我 - Frank Chen"$/m);
  assert.match(md, /^description: "這是描述"$/m);
  assert.match(md, /^canonical: "https:\/\/frankchen\.tw\/about\/"$/m);
  assert.match(md, /^image: "https:\/\/frankchen\.tw\/cover\.webp"$/m);
  // 文章契約的欄位對列表頁與靜態頁沒有意義，硬湊值等於編造資料。
  assert.doesNotMatch(md, /^date:/m);
  assert.doesNotMatch(md, /^category:/m);
  assert.doesNotMatch(md, /^tags:/m);
});

test('buildPageMarkdown：標題階層與清單轉成 markdown', () => {
  const body = '<h2>小標</h2><ul><li>項目一</li><li>項目二</li></ul>';
  const md = buildPageMarkdown(page({ body }), ORIGIN);
  assert.match(md, /^## 小標$/m);
  assert.match(md, /^- 項目一$/m);
});

// turndown 內建的 listItem 規則把前綴寫死成「marker + 三個空白」（有序清單是「數字 + . + 兩個
// 空白」），page-md.mjs 覆寫成單一空白。這條把改寫後的兩種前綴都釘住：改回內建規則、或覆寫
// 時只顧到無序清單，產物排版都會變而沒有任何斷言會紅。
test('buildPageMarkdown：清單前綴為單一空白，有序清單接續編號', () => {
  const body = '<ul><li>無序</li></ul><ol><li>第一</li><li>第二</li></ol><ol start="3"><li>第三</li></ol>';
  const md = buildPageMarkdown(page({ body }), ORIGIN);
  assert.match(md, /^- 無序$/m);
  assert.match(md, /^1\. 第一$/m);
  assert.match(md, /^2\. 第二$/m);
  assert.match(md, /^3\. 第三$/m);
});

// 麵包屑住在 #main-content 裡，不剝掉的話每份頁面 md 開頭都會多一段導覽有序清單——
// 而本功能的意義就是省 token。與 Breadcrumbs.astro 的 class 名稱耦合，這條是守門人。
test('buildPageMarkdown：麵包屑導覽不進輸出', () => {
  const body =
    '<nav class="breadcrumbs" aria-label="麵包屑"><ol>' +
    '<li><a href="/">首頁</a><span aria-hidden="true">/</span></li>' +
    '<li aria-current="page">關於我</li></ol></nav><h1>Frank Chen</h1><p>內文</p>';
  const md = buildPageMarkdown(page({ body }), ORIGIN);
  assert.ok(!md.includes('1. [首頁]'));
  // 正文須直接由 H1 起始：verify-seo 對產物有同一條斷言。
  assert.match(md, /^---\n[\s\S]*?\n---\n\n# Frank Chen$/m);
});

// md 可能被 agent 搬離本站脈絡後閱讀，站內相對連結在那裡解不開。
test('buildPageMarkdown：站內連結絕對化', () => {
  const body = '<p><a href="/category/n8n/">n8n 分類</a></p>';
  const md = buildPageMarkdown(page({ body }), ORIGIN);
  assert.match(md, /\[n8n 分類\]\(https:\/\/frankchen\.tw\/category\/n8n\/\)/);
});

// 目標的字元類必須排除空白，所以帶 title 的連結（turndown 對 <a title> 的輸出形狀）
// 若沒有單獨處理就會整條不匹配，靜默留下站內相對路徑。現行版面無此用法，這條釘的是假設。
test('buildPageMarkdown：帶 title 的站內連結一樣絕對化且保留 title', () => {
  const body = '<p><a href="/about/" title="作者簡介">關於我</a></p>';
  const md = buildPageMarkdown(page({ body }), ORIGIN);
  assert.match(md, /\[關於我\]\(https:\/\/frankchen\.tw\/about\/ "作者簡介"\)/);
});

test('buildPageMarkdown：外部連結不被加上本站前綴', () => {
  const body = '<p><a href="https://example.com/x">外部</a></p>';
  const md = buildPageMarkdown(page({ body }), ORIGIN);
  assert.match(md, /\[外部\]\(https:\/\/example\.com\/x\)/);
});

// 圖示 svg 與 View Transitions 的內聯樣式若被轉成文字，會變成 agent 要付費閱讀的雜訊。
test('buildPageMarkdown：script / style / svg 不進輸出', () => {
  const body = '<p>內文</p><svg><title>圖示</title></svg><script>console.log(1)</script><style>.a{}</style>';
  const md = buildPageMarkdown(page({ body }), ORIGIN);
  assert.ok(!md.includes('圖示'));
  assert.ok(!md.includes('console.log'));
  assert.ok(!md.includes('.a{}'));
});

test('buildPageMarkdown：HTML 實體還原成原字元', () => {
  const md = buildPageMarkdown(page({ title: 'n8n &amp; Flutter' }), ORIGIN);
  assert.match(md, /^title: "n8n & Flutter"$/m);
});

// 迴歸測試：metaContent／linkHref 曾用 [^"']* 排除雙引號與單引號，但屬性值本身只被
// 其中一種引號包住，值裡出現另一種引號（例如標籤名稱帶英文單引號）就會在那個字元被
// 提早截斷。canonical 沿用實際踩到的案例：/tag/Let's Encrypt/ 的 href 含單引號。
test('buildPageMarkdown：屬性值含單引號不得被截斷', () => {
  const html = `<!DOCTYPE html><html lang="zh-TW"><head>
<title>標籤：Let's Encrypt</title>
<meta name="description" content="站上標記「Let's Encrypt」的技術文章">
<link rel="canonical" href="https://frankchen.tw/tag/Let's%20Encrypt/">
<meta property="og:image" content="https://frankchen.tw/cover.webp">
</head><body>
<nav><a href="/">首頁</a></nav>
<div id="main-content" tabindex="-1"><p>內文</p></div>
<footer><p>版權宣告</p></footer>
</body></html>`;
  const md = buildPageMarkdown(html, ORIGIN);
  assert.match(md, /^title: "標籤：Let's Encrypt"$/m);
  assert.match(md, /^description: "站上標記「Let's Encrypt」的技術文章"$/m);
  assert.match(md, /^canonical: "https:\/\/frankchen\.tw\/tag\/Let's%20Encrypt\/"$/m);
});

test('buildPageMarkdown：找不到主內容區時拋錯', () => {
  assert.throws(
    () => buildPageMarkdown('<html><body><p>沒有容器</p></body></html>', ORIGIN),
    /main-content/,
  );
});
