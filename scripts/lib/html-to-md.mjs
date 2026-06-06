import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';

function htmlDecode(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // &amp; 必須最後
}

function extractCodeBlocksPro(html) {
  const blocks = [];
  // 開頭註解 JSON 在單行內，故 \{.*\} 用貪婪配到 ' -->'；中間渲染 HTML 用 [\s\S]*? 非貪婪到收尾註解
  const re = /<!-- wp:kevinbatdorf\/code-block-pro (\{.*\}) -->[\s\S]*?<!-- \/wp:kevinbatdorf\/code-block-pro -->/g;
  const replaced = html.replace(re, (whole, json) => {
    let code = '', language = '';
    try {
      const obj = JSON.parse(json);
      code = htmlDecode(obj.code || '');
      language = (obj.language || '').trim();
    } catch {
      return whole; // JSON parse 失敗 → 原樣保留交給 turndown
    }
    const token = `CBPLACEHOLDER${blocks.length}END`;
    blocks.push('```' + language + '\n' + code + '\n```');
    return `\n\n${token}\n\n`;
  });
  return { replaced, blocks };
}

function extractWpCodeBlocks(html) {
  const blocks = [];
  const re = /<!-- wp:code(?: (\{[^}]*\}))? -->\s*<pre[^>]*class="[^"]*wp-block-code[^"]*"[^>]*>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>\s*<!-- \/wp:code -->/g;
  const replaced = html.replace(re, (whole, jsonStr, codeAttrs, rawContent) => {
    let language = '';
    // 1. 先試 wp:code 註解 JSON 的 language
    if (jsonStr) {
      try {
        const obj = JSON.parse(jsonStr);
        if (obj.language) language = obj.language.trim();
      } catch {
        // JSON parse 失敗忽略，繼續試屬性
      }
    }
    // 2. 再試 <code> 屬性：class="language-xxx" 或 lang="xxx"
    if (!language && codeAttrs) {
      const langClass = codeAttrs.match(/class="[^"]*language-(\w+)/);
      if (langClass) language = langClass[1];
    }
    if (!language && codeAttrs) {
      const langAttr = codeAttrs.match(/\blang="(\w+)"/);
      if (langAttr) language = langAttr[1];
    }
    const code = htmlDecode(rawContent).replace(/\s+$/, '');
    const token = `WPCODEPLACEHOLDER${blocks.length}END`;
    blocks.push('```' + language + '\n' + code + '\n```');
    return `\n\n${token}\n\n`;
  });
  return { replaced, blocks };
}

function makeTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  });

  // GFM 表格支援（turndown 內建不處理 <table>，會把儲存格打平成逐行段落）
  td.use(tables);

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

// turndown-plugin-gfm 只轉「有表頭列」的表格（首列全為 <th>），否則保留原始 HTML。
// 無 <th> 的表格將首列 <td> 升為 <th>，讓它一致轉成 GFM pipe table。
function promoteHeaderlessTables(html) {
  return html.replace(/<table[\s\S]*?<\/table>/gi, (table) => {
    if (/<th[\s>]/i.test(table)) return table; // 已有表頭，不動
    let promoted = false;
    return table.replace(/<tr[\s\S]*?<\/tr>/i, (firstRow) => {
      if (promoted) return firstRow;
      promoted = true;
      return firstRow
        .replace(/<td(\s[^>]*)?>/gi, '<th>')
        .replace(/<\/td>/gi, '</th>');
    });
  });
}

export function htmlToMarkdown(html) {
  const { replaced: replacedPro, blocks: blocksPro } = extractCodeBlocksPro(html || '');
  const { replaced: replacedWp, blocks: blocksWp } = extractWpCodeBlocks(replacedPro);
  const cleaned = promoteHeaderlessTables(stripWpComments(replacedWp));
  const td = makeTurndown();
  let md = td.turndown(cleaned).replace(/\n{3,}/g, '\n\n').trim();
  blocksPro.forEach((b, i) => {
    md = md.replace(`CBPLACEHOLDER${i}END`, () => b); // function replacer 避免 $ 被當特殊
  });
  blocksWp.forEach((b, i) => {
    md = md.replace(`WPCODEPLACEHOLDER${i}END`, () => b);
  });
  return md + '\n';
}
