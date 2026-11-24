// ads.txt。AdSense の行は publisher ID から自動で出す。SSP の行は src/config/ads.ts の adsTxtExtraLines に足す。
// public/ads.txt を直接置きたい場合は、このファイルを削除してから置く（両方あるとビルドで衝突する）。
import { ADS, isAdsEnabled } from '../config/ads';
export const GET = () => {
  const lines: string[] = [];
  if (isAdsEnabled()) lines.push(`google.com, ${ADS.publisherId.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0`);
  lines.push(...ADS.adsTxtExtraLines);
  const body = lines.length ? lines.join('\n') : '# ads.txt: 広告配信の承認後に記載します';
  return new Response(`${body}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
