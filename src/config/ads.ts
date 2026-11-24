/**
 * 広告（AdSense / 将来のSSP）の設定。
 *
 * publisherId は審査通過後に設定する。プレースホルダ（空、または X を含む値）のままなら
 * 広告スクリプト・広告枠は1つも描画しない（空の枠も出さない）。
 * 環境変数 PUBLIC_ADSENSE_CLIENT が設定されていればそちらを優先する。
 */
const envClient =
  ((import.meta as any).env?.PUBLIC_ADSENSE_CLIENT as string | undefined) ?? process.env.PUBLIC_ADSENSE_CLIENT;

export const ADS = {
  /** 例: 'ca-pub-1234567890123456' */
  publisherId: (envClient && envClient.trim()) || 'ca-pub-XXXXXXXXXXXXXXXX',

  /** 広告ユニットのスロットID（AdSense管理画面で発行）。空の枠は描画しない */
  slots: {
    articleTop: '',
    inArticle: '',
    sidebar: '',
    inList: '',
  },

  /** 本文中の広告：h2 見出し何個ごとに1枠差し込むか / 1記事あたりの上限 */
  inArticle: { everyHeadings: 2, max: 3 },

  /** 一覧：記事カード何件ごとに1枠差し込むか */
  inListEvery: 6,

  /**
   * ads.txt に追記する行（SSP導入時に足すだけでよい）。
   * AdSense の行は publisherId から自動で出力する。
   * 例: 'example-ssp.com, 12345, DIRECT, abcdef0123456789'
   */
  adsTxtExtraLines: [] as string[],
};

/** publisher ID が本物に差し替わっているか */
export function isAdsEnabled(): boolean {
  const id = ADS.publisherId;
  return /^ca-pub-\d{10,}$/.test(id);
}

/** 実際に出す枠のスロットID。広告無効 or スロット未設定なら null */
export function slotFor(position: keyof typeof ADS.slots): string | null {
  if (!isAdsEnabled()) return null;
  const s = ADS.slots[position];
  return s ? s : null;
}
