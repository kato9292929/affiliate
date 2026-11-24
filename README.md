# セキュリティニュースメディア（Astro）

x402 Inc. が運営するセキュリティニュースメディア。Astro の静的サイト。

## コマンド

| コマンド | 内容 |
|---|---|
| `pnpm dev` | 開発サーバー |
| `pnpm build` | `check:offers` → `astro build` → Pagefind の検索インデックス生成 |
| `pnpm check:offers` | 案件データと記事の参照を検査（エラーなら終了コード1） |
| `pnpm check:content` | stock の記事の禁止表現を警告（`--strict` で終了コード1） |
| `pnpm test:checks` | 上の2つがダミーの不正データを検出できるかのテスト |
| `pnpm import:offers <file>` | `offers-additions.yaml` 形式の案件を `offers.yaml` に追記 |

## 設定の置き場所

| 項目 | 場所 |
|---|---|
| 公開URL（サブドメイン） | `site.config.ts`、または環境変数 `PUBLIC_SITE_URL`（未設定なら Vercel の本番URL） |
| サイト名・運営会社・連絡先メール | `site.config.ts` |
| AdSense publisher ID・スロット・ads.txt の追加行 | `src/config/ads.ts`（または環境変数 `PUBLIC_ADSENSE_CLIENT`） |
| GA4 測定ID | 環境変数 `PUBLIC_GA4_ID` |
| 色・フォント・余白 | `src/styles/tokens.css` |
| 定型の注意書き（広告表記・投資のリスク） | `src/config/disclaimers.ts` |

publisher ID がプレースホルダ（`ca-pub-XXXXXXXXXXXXXXXX`）のままなら、広告スクリプトと広告枠は1つも出ません。GA4 も ID が未設定なら出ません。

## データ

```
src/data/offers.yaml           案件リンク（Muse が更新）
data/affiliate-programs.csv    案件台帳（Muse が更新）。registration 列が登録番号の正
src/data/supervisors.yaml      監修者
src/data/categories.yaml       カテゴリ（コレクションごと）
src/data/brokers.yaml          証券会社（/stock/broker/<キー>/ を作る）
src/data/comparisons/*.yaml    比較表データ
src/data/banned-phrases.yaml   stock の禁止表現
```

`affiliate-programs.csv` はリポジトリの `data/` に置く。列名は `id`（または `offer_id`）と `registration`（または `登録番号`）を読む。報酬・条件の列はサイトには一切出さない。

### Muse の運用（offers.yaml と affiliate-programs.csv だけを触る）

- 追加：`offers.yaml` に1件足し、`affiliate-programs.csv` に同じ id の行を足す
- 提携後：`url` にアフィリエイトURLを入れ、`active: true` にする（記事のリンクと広告表記が自動で切り替わる）
- 終了：削除せず `active: false` に戻す（記事は公式リンク `fallbackUrl` になる）
- 変更したら `pnpm check:offers` を通す（Vercel のビルドでも自動で走る）

`check:offers` が検出するもの：YAML の構文エラー・スキーマ違反、id の重複、記事が存在しない id を参照、本文の `<Offer>` が frontmatter の `offers` に無い、`active: true` で `url` が空、`fallbackUrl` がURLでない、株式の記事（比較表・証券会社ページを含む）が registration の空いた案件を参照。

## 記事

`src/content/{news,guides,reviews,stock}/` に `.md` / `.mdx`。スキーマは `src/content.config.ts`。`category` と `supervisor` が定義ファイルに無ければビルドエラー、`isComparison: true` なら `infoDate` が必須。

本文で使えるコンポーネント（import 不要、`.mdx` で使う）：

```mdx
<Offer id="sample-edr" />                  テキストリンク
<Offer id="sample-edr">リンク文言</Offer>
<OfferButton id="sample-edr" label="..." />  ボタン
<ComparisonTable data="broker-security" />   比較表（登録番号・情報基準日の列は必ず出る）
```

テンプレートが自動で出すもの：監修者（記事・カード）、公開日・更新日・情報基準日、出典一覧、ニュースの概要ボックス、広告表記（`offers` に active な案件があれば）、stock のリスク・手数料の注意書き、投資の基礎（`stock` の `basics`）の監修範囲の注記、ニュース下の関連する対策・比較へのリンク、本文中の広告枠（h2 の数に応じて）、OGP画像、構造化データ。

証券会社別ページ：記事の `tags` に `broker:<キー>` を付けると `/stock/broker/<キー>/` に集まる。

## デプロイ

Vercel（Framework: Astro、Build: `pnpm build`、Output: `dist`）。環境変数 `PUBLIC_SITE_URL` / `PUBLIC_GA4_ID` / `PUBLIC_ADSENSE_CLIENT` を設定する。
