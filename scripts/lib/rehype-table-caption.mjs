// scripts/lib/rehype-table-caption.mjs
// Markdown 表格語法產不出 <caption>，同一頁多個表格時螢幕閱讀器只會念「表格」，
// 使用者無從分辨這是哪一張。這裡在渲染階段補上可及名稱。

const HEADING_TAGS = new Set(['h2', 'h3', 'h4']);
const FALLBACK_LABEL = '資料表格';

/** 遞迴取出節點下的純文字（標題內可能含 <code>、<strong> 等行內元素）。 */
function textOf(node) {
  if (node.type === 'text') return node.value;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(textOf).join('');
}

/**
 * 為每個 <table> 補可及名稱：
 * 取文件順序上最近的前置標題（h2–h4）文字，以視覺隱藏的 <caption> 呈現；
 * 用 <caption> 而非 aria-label，是因為它是表格原生的名稱來源，
 * 且對輔助科技與 AI 爬蟲都是可讀的文字內容。找不到標題才退回 aria-label。
 *
 * 不依賴 unist-util-visit：那只是 Astro 的傳遞相依，未列在本專案 package.json，
 * 直接 import 會在相依樹變動時無預警壞掉，走訪邏輯自己寫十行就夠。
 */
export function rehypeTableCaption() {
  return (tree) => {
    // 前序走訪，順序即文件順序，因此可用單一變數追蹤「最近出現過的標題」。
    let lastHeading = null;

    const walk = (node) => {
      if (node.type === 'element') {
        if (HEADING_TAGS.has(node.tagName)) {
          lastHeading = textOf(node).trim() || null;
        } else if (node.tagName === 'table') {
          addCaption(node, lastHeading);
        }
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) walk(child);
      }
    };

    walk(tree);
  };
}

function addCaption(table, heading) {
  const children = table.children ?? [];
  // 已有 caption（例如作者手寫的 HTML 表格）就尊重原內容，不覆蓋。
  if (children.some((c) => c.type === 'element' && c.tagName === 'caption')) return;

  if (!heading) {
    table.properties = { ...table.properties, 'aria-label': FALLBACK_LABEL };
    return;
  }

  table.children = [
    {
      type: 'element',
      tagName: 'caption',
      properties: { className: ['visually-hidden'] },
      children: [{ type: 'text', value: heading }],
    },
    ...children,
  ];
}

export default rehypeTableCaption;
