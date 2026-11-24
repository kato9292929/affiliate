// OGP画像のビルド時生成（satori → resvg）。記事に image が無い場合に使う。
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { SITE } from '../../site.config';

const require = createRequire(import.meta.url);
let font: Buffer | undefined;
const getFont = () =>
  (font ??= readFileSync(require.resolve('@expo-google-fonts/noto-sans-jp/700Bold/NotoSansJP_700Bold.ttf')));

const h = (type: string, style: Record<string, unknown>, children?: unknown) => ({ type, props: { style, children } });

export async function ogImage({ title, label }: { title: string; label?: string }) {
  const svg = await satori(
    h('div', {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '64px', background: '#0b4ea2', color: '#ffffff', fontFamily: 'Noto Sans JP',
    }, [
      label ? h('div', { display: 'flex', fontSize: 32, color: '#cfe0ff' }, label) : h('div', { display: 'flex' }, ''),
      h('div', { display: 'flex', fontSize: title.length > 40 ? 52 : 64, lineHeight: 1.35, fontWeight: 700 }, title),
      h('div', { display: 'flex', fontSize: 30, color: '#cfe0ff' }, `${SITE.name}（運営：${SITE.publisher.name}）`),
    ]) as any,
    { width: 1200, height: 630, fonts: [{ name: 'Noto Sans JP', data: getFont(), weight: 700, style: 'normal' }] },
  );
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
