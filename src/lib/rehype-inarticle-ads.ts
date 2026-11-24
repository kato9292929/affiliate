// 本文中の広告枠を、h2 見出しの数に応じて自動で差し込む rehype プラグイン。
// publisher ID または本文中枠のスロットが未設定なら何も差し込まない（空の枠も出さない）。
import { ADS, slotFor } from '../config/ads';

type Node = { type: string; tagName?: string; children?: Node[]; properties?: Record<string, unknown>; value?: string };

function adNode(client: string, slot: string): Node {
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['ad', 'ad-in-article'], 'data-ad-position': 'in-article' },
    children: [
      { type: 'element', tagName: 'span', properties: { className: ['ad-label'] }, children: [{ type: 'text', value: '広告' }] },
      {
        type: 'element',
        tagName: 'ins',
        properties: {
          className: ['adsbygoogle'],
          style: 'display:block',
          'data-ad-client': client,
          'data-ad-slot': slot,
          'data-ad-format': 'auto',
          'data-full-width-responsive': 'true',
        },
        children: [],
      },
      { type: 'element', tagName: 'script', properties: {}, children: [{ type: 'text', value: '(adsbygoogle=window.adsbygoogle||[]).push({});' }] },
    ],
  };
}

export function rehypeInArticleAds() {
  return (tree: Node) => {
    const slot = slotFor('inArticle');
    if (!slot || !tree.children) return;
    const { everyHeadings, max } = ADS.inArticle;
    const out: Node[] = [];
    let h2 = 0;
    let inserted = 0;
    for (const node of tree.children) {
      if (node.type === 'element' && node.tagName === 'h2') {
        h2++;
        // 2つ目以降の h2 の直前に、everyHeadings 個ごとに1枠（最初の見出しの前には置かない）
        if (h2 > 1 && (h2 - 1) % everyHeadings === 0 && inserted < max) {
          out.push(adNode(ADS.publisherId, slot));
          inserted++;
        }
      }
      out.push(node);
    }
    tree.children = out;
  };
}
