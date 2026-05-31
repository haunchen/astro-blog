import TurndownService from 'turndown';

function makeTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  });

  // figure > img (+figcaption) → ![caption](src)
  td.addRule('wpImage', {
    filter: (node) =>
      node.nodeName === 'FIGURE' && node.querySelector && node.querySelector('img'),
    replacement: (_content, node) => {
      const img = node.querySelector('img');
      const src = img.getAttribute('src') || '';
      const cap = node.querySelector('figcaption');
      const alt = (cap && cap.textContent.trim()) || img.getAttribute('alt') || '';
      return src ? `\n\n![${alt}](${src})\n\n` : '';
    },
  });

  // 裸 <img>（不在 figure 內）
  td.addRule('bareImage', {
    filter: 'img',
    replacement: (_c, node) => {
      const src = node.getAttribute('src') || '';
      const alt = node.getAttribute('alt') || '';
      return src ? `![${alt}](${src})` : '';
    },
  });

  return td;
}

// 先用 regex 移除 Gutenberg 註解，turndown 不認得 HTML comment 的去留
function stripWpComments(html) {
  return html.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '');
}

export function htmlToMarkdown(html) {
  const cleaned = stripWpComments(html || '');
  const td = makeTurndown();
  return td
    .turndown(cleaned)
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}
