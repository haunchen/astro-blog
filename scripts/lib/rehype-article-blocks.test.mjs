import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rehypeArticleBlocks } from './rehype-article-blocks.mjs';

const text = (value) => ({ type: 'text', value });
const el = (tagName, ...children) => ({ type: 'element', tagName, properties: {}, children });
const heading = (tagName, value) => el(tagName, text(value));
const para = (value) => el('p', text(value));

/** 跑 plugin 並回傳根節點的 children。 */
function transform(...children) {
  const tree = { type: 'root', children };
  rehypeArticleBlocks()(tree);
  return tree.children;
}

/** 把節點壓成「標籤.class」字串，讓斷言讀得出結構。 */
function shape(node) {
  if (node.type !== 'element') return node.type;
  const className = node.properties.className?.[0];
  return className ? `${node.tagName}.${className}` : node.tagName;
}

test('rehypeArticleBlocks：常見問題區塊的引言留在 faq-list 外', () => {
  const out = transform(heading('h2', '常見問題'), para('引言'), heading('h3', '第一題？'), para('答案'));
  assert.deepEqual(out.map(shape), ['h2', 'p', 'div.faq-list']);
});

test('rehypeArticleBlocks：每個 h3 成為一個 details，各自帶 summary 與 faq-answer', () => {
  const out = transform(
    heading('h2', '常見問題'),
    heading('h3', '第一題？'),
    para('答案一'),
    heading('h3', '第二題？'),
    para('答案二之一'),
    para('答案二之二'),
  );
  const items = out[1].children;
  assert.deepEqual(items.map(shape), ['details.faq-item', 'details.faq-item']);
  assert.deepEqual(items[1].children.map(shape), ['summary', 'div.faq-answer']);
  assert.deepEqual(items[1].children[1].children.map(shape), ['p', 'p']);
});

test('rehypeArticleBlocks：題目的 h3 節點原封不動移進 summary', () => {
  const question = heading('h3', '第一題？');
  const out = transform(heading('h2', '常見問題'), question, para('答案'));
  const summary = out[1].children[0].children[0];
  assert.equal(summary.children[0], question);
});

test('rehypeArticleBlocks：常見問題區塊止於下一個 h2', () => {
  const out = transform(
    heading('h2', '常見問題'),
    heading('h3', '第一題？'),
    para('答案'),
    heading('h2', '結語'),
    para('收尾'),
  );
  assert.deepEqual(out.map(shape), ['h2', 'div.faq-list', 'h2', 'p']);
});

test('rehypeArticleBlocks：沒有 h3 的常見問題區塊維持原樣', () => {
  const out = transform(heading('h2', '常見問題'), para('只有一段話'));
  assert.deepEqual(out.map(shape), ['h2', 'p']);
});

test('rehypeArticleBlocks：故障排除區塊的內容包進 prose-block，h2 留在外面', () => {
  const out = transform(heading('h2', '故障排除指南'), heading('h3', '連不上'), para('處置'));
  assert.deepEqual(out.map(shape), ['h2', 'div.prose-block']);
  assert.deepEqual(out[1].children.map(shape), ['h3', 'p']);
});

test('rehypeArticleBlocks：文末連結區塊的內容包進 prose-block', () => {
  const out = transform(heading('h2', '參考資料與延伸閱讀'), el('ul', el('li', text('來源'))));
  assert.deepEqual(out.map(shape), ['h2', 'div.prose-block']);
});

test('rehypeArticleBlocks：一般章節不變', () => {
  const out = transform(heading('h2', '前言'), heading('h3', '背景'), para('內文'));
  assert.deepEqual(out.map(shape), ['h2', 'h3', 'p']);
});

test('rehypeArticleBlocks：h2 的文字包在行內元素裡也認得出區塊', () => {
  const out = transform(el('h2', el('strong', text('常見問題'))), heading('h3', '第一題？'), para('答案'));
  assert.deepEqual(out.map(shape), ['h2', 'div.faq-list']);
});
