/**
 * サイト全体の設定。公開URL（サブドメイン）はここ1か所、または環境変数 PUBLIC_SITE_URL で差し替える。
 */
const env = (key: string): string | undefined => {
  const v = (import.meta as any).env?.[key] ?? process.env[key];
  return v && String(v).trim() ? String(v).trim() : undefined;
};

/** 公開URL。優先順: PUBLIC_SITE_URL → Vercel の本番URL → localhost */
export const SITE_URL: string = (
  env('PUBLIC_SITE_URL') ??
  (env('VERCEL_PROJECT_PRODUCTION_URL') ? `https://${env('VERCEL_PROJECT_PRODUCTION_URL')}` : undefined) ??
  'http://localhost:4321'
).replace(/\/$/, '');

export const SITE = {
  url: SITE_URL,
  /** サイト名（仮）。決まったらここだけ変える */
  name: 'x402 セキュリティニュース',
  shortName: 'x402 Security News',
  description:
    '情報漏えい・ランサムウェア・脆弱性などのセキュリティニュースと、法人・個人のセキュリティ対策、証券口座のセキュリティを解説するメディア。',
  lang: 'ja',
  locale: 'ja_JP',
  /** 運営会社 */
  publisher: {
    name: 'x402 Inc.',
    url: 'https://x402jp.com',
    /** 運営者情報の連絡先（本人から受け取り後に設定） */
    email: '',
  },
  /** 一覧の1ページあたり件数 */
  pageSize: 20,
};
