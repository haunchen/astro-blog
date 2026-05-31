const VALID = new Set(['n8n', 'flutter', 'devops', 'raspberry-pi', 'tools']);

export function mapCategory(nicename) {
  if (VALID.has(nicename)) return nicename;
  return 'n8n'; // uncategorized 與其餘未知值歸 n8n
}

export function toIsoDate(pubDate) {
  const d = new Date(pubDate);
  return d.toISOString().slice(0, 10);
}

// 取第一個 <p> 的純文字（空 excerpt fallback 用）
function firstParagraphText(html) {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const raw = match ? match[1] : html;
  return raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MAX = 160;

export function makeDescription(excerpt, contentHtml) {
  let base = (excerpt || '').trim();
  if (!base) base = firstParagraphText(contentHtml || '').slice(0, 150);
  if (base.length <= MAX) return base;

  // 句號處截斷（保留 …，故在 MAX-1 範圍內找最後一個句號）
  const window = base.slice(0, MAX - 1);
  const lastPeriod = Math.max(window.lastIndexOf('。'), window.lastIndexOf('. '));
  if (lastPeriod > 40) {
    return window.slice(0, lastPeriod + 1) + '…';
  }
  // 找不到合適句號 → 硬切
  return base.slice(0, MAX - 3) + '…';
}
