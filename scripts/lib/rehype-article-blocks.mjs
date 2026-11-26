// scripts/lib/rehype-article-blocks.mjs
// markdown 產出的 h2、h3、段落是平行的兄弟節點，CSS 框不住「一節」或「一題」。
// 這裡在渲染階段依區塊標題把節的內容包起來：常見問題區塊變成風琴，
// 故障排除區塊與文末連結區塊各包成一個框。規格見 docs/specs/article-blocks.md。

import { classifyBlockHeading } from './article-blocks.mjs';

/** 遞迴取出節點下的純文字（標題內可能含 <code>、<strong> 等行內元素）。 */
function textOf(node) {
  if (node.type === 'text') return node.value;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(textOf).join('');
}

const isElement = (node, tagName) => node.type === 'element' && node.tagName === tagName;

/**
 * GFM 註腳區（remark-rehype 產生的 <section data-footnotes class="footnotes">）掛在根層尾端，
 * 不屬於文章最後一節；它的 h2 在 section 裡面，不會在根層替那一節收尾。
 * 不把它當邊界，最後一節若是區塊，註腳區就會被包進框或收進最後一題的答案。
 */
const isFootnotesSection = (node) => isElement(node, 'section') && node.properties?.dataFootnotes === true;

/** 一節止於下一個根層 h2 或註腳區。 */
const endsSection = (node) => isElement(node, 'h2') || isFootnotesSection(node);

const element = (tagName, className, children) => ({
  type: 'element',
  tagName,
  properties: className ? { className: [className] } : {},
  children,
});

/**
 * 常見問題區塊：第一個 h3 之前是引言，留在外面；之後每個 h3 連同它底下的內容是一題。
 * 沒有 h3 就不動——那是結構檢查 E1 會擋下的寫法，這裡不替它猜題目在哪。
 * h3 節點本身原樣搬進 <summary>：Astro 之後才替標題加 id，目錄與錨點靠那個 id。
 */
function wrapFaq(body) {
  const first = body.findIndex((node) => isElement(node, 'h3'));
  if (first === -1) return body;

  const items = [];
  for (const node of body.slice(first)) {
    if (isElement(node, 'h3')) items.push({ question: node, answer: [] });
    else items[items.length - 1].answer.push(node);
  }

  const list = element(
    'div',
    'faq-list',
    items.map(({ question, answer }) =>
      element('details', 'faq-item', [
        element('summary', null, [question]),
        element('div', 'faq-answer', answer),
      ]),
    ),
  );
  return [...body.slice(0, first), list];
}

/** 故障排除區塊與文末連結區塊：整節內容包成一個框，內容不動。 */
function wrapBlock(body) {
  if (!body.some((node) => node.type === 'element')) return body;
  return [element('div', 'prose-block', body)];
}

/**
 * 不依賴 unist-util-visit：區塊標題只會出現在根節點的直接子層，
 * 掃一輪根節點的 children 就夠，不必走訪整棵樹。
 */
export function rehypeArticleBlocks() {
  return (tree) => {
    const children = tree.children;
    const out = [];
    let i = 0;

    while (i < children.length) {
      const node = children[i];
      if (!isElement(node, 'h2')) {
        out.push(node);
        i += 1;
        continue;
      }

      let end = i + 1;
      while (end < children.length && !endsSection(children[end])) end += 1;
      const body = children.slice(i + 1, end);
      const kind = classifyBlockHeading(textOf(node));

      out.push(node);
      if (kind === 'faq') out.push(...wrapFaq(body));
      else if (kind !== null) out.push(...wrapBlock(body));
      else out.push(...body);
      i = end;
    }

    tree.children = out;
  };
}

export default rehypeArticleBlocks;
