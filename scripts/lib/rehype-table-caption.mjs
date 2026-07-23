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
    // 前序走訪，順序即文件順序，所以「目前所在的標題階層」可以邊走邊維護。
    // 只取最近的 h2 是不夠的：同一篇文章常出現多個字面相同的 h3
    //（例如三個平台各有一節「費用與限制」），單取 h3 會產生重複的可及名稱，
    // 等於沒解決「分不出是哪張表」。因此用 h2 › h3 › h4 的路徑當名稱。
    const headingByLevel = new Map();
    // 路徑仍可能撞名（同一節裡連續多張表），最後再用出現次數補序號，
    // 保證每頁的 caption 全域唯一。
    const usedLabels = new Map();

    const walk = (node) => {
      if (node.type === 'element') {
        if (HEADING_TAGS.has(node.tagName)) {
          const level = Number(node.tagName.slice(1));
          headingByLevel.set(level, textOf(node).trim() || null);
          // 進到新的同級／上層標題時，更深層的標題已經離開作用範圍
          for (const deeper of [...headingByLevel.keys()]) {
            if (deeper > level) headingByLevel.delete(deeper);
          }
        } else if (node.tagName === 'table') {
          const path = [...headingByLevel.keys()]
            .sort((a, b) => a - b)
            .map((lv) => headingByLevel.get(lv))
            .filter(Boolean);
          let label = path.length ? path.join(' › ') : null;
          if (label) {
            const seen = (usedLabels.get(label) ?? 0) + 1;
            usedLabels.set(label, seen);
            if (seen > 1) label = `${label}（表 ${seen}）`;
          }
          addCaption(node, label);
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
