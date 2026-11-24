/** GA4 測定ID（環境変数 PUBLIC_GA4_ID）。未設定ならタグを出さない */
const raw = ((import.meta as any).env?.PUBLIC_GA4_ID as string | undefined) ?? process.env.PUBLIC_GA4_ID;
export const GA4_ID: string | null = raw && /^G-[A-Z0-9]+$/.test(raw.trim()) ? raw.trim() : null;
