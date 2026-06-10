# AIコンテストナビ

AI画像、AI動画、AI漫画、AI音楽など、生成AIで参加できるコンテスト情報を紹介する静的サイトです。

## ローカル起動

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

ビルド結果は `dist/` に出力されます。

## Cloudflare Pages

- 現在は GitHub Actions から Cloudflare Pages へデプロイします
- `main` ブランチへpushすると `.github/workflows/deploy-cloudflare-pages.yml` が動きます
- Direct Uploadで作成したPagesプロジェクトでも、この構成ならGitHub更新ごとに自動デプロイできます
- Cloudflare Pagesのproduction branchは `main` に設定済みです
- 公開URL: `https://ai-contest-navi.pages.dev/`

Cloudflare Pages側の設定値:

- Framework preset: `Astro`
- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`
- Node.js version: `20.19.5`
- Wrangler config: `wrangler.toml`

環境変数:

- `SITE_URL`: 公開URL。例 `https://ai-contest-navi.pages.dev`
- `NOTION_TOKEN`: Notion API連携用
- `NOTION_DATABASE_ID`: Notion DB連携用
- `NODE_VERSION`: `20.19.5`

GitHub ActionsのSecrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `SITE_URL`
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`

サイトマップ:

- `SITE_URL/sitemap-index.xml`
- 実体は `SITE_URL/sitemap-0.xml` に生成されます
- `robots.txt` は `sitemap-index.xml` を指します

OGP画像:

- トップページ: `/og-home.svg`
- 通常ページ: `/og-default.svg`
- 詳細ページ: コンテストのサムネイルを使用
- 詳細ページでサムネイルがない場合: `/og-contest.svg`

公開後QA:

```bash
SITE_URL=https://ai-contest-navi.pages.dev npm run qa:site
```

Windows PowerShellの場合:

```powershell
$env:SITE_URL="https://ai-contest-navi.pages.dev"
npm run qa:site
```

このQAでは主要ページ、`robots.txt`、`sitemap-index.xml`、`sitemap-0.xml`、OGP画像、canonical、`og:url`、`og:image` を確認します。

## Notion CMS連携

ビルド時に `NOTION_TOKEN` と `NOTION_DATABASE_ID` が設定されている場合、Notion APIからコンテスト情報を取得します。

Notion API取得に失敗した場合、または環境変数が未設定の場合は、`src/data/contests.ts` の仮データにフォールバックします。

Notion DB側で想定している主なプロパティ:

- `コンテスト名`
- `ステータス` または `開催ステータス`
- `締切日`
- `ジャンル`
- `賞金・賞品`
- `応募形式` または `応募方法`
- `参加しやすさ`
- `AI使用条件`
- `権利注意度` または `著作権・二次利用条件`
- `公式URL`
- `サムネイル`
- `紹介文` または `概要`
- `注目表示`
- `slug` または `スラッグ`

### slug運用ルール

- Notion側の `slug` を最優先します
- `slug` がなければ `スラッグ` を使用します
- どちらもない場合は、タイトルとページIDから自動生成します
- 自動生成時はビルドログに警告を出します
- slugは英小文字、数字、ハイフンで管理してください
- 公開後にslugを変えるとURLが変わるため、基本的に変更しないでください
- 例: `first-ai-manga-contest`、`aaiff-2026`

データ取得処理は `src/lib/notion.ts`、サイト側で使う取得関数は `src/lib/contests.ts` に分離しています。

既存ページにslugを同期する場合:

```bash
npm run notion:sync-slugs
```

公式ページのOGP画像をNotionの `サムネイル` とページカバーへ同期する場合:

```bash
npm run notion:sync-thumbnails
```

既存サムネイルも上書きして取り直す場合:

```bash
npm run notion:sync-thumbnails -- --force
```

### 新しいコンテストを追加する手順

1. Notion DBに新規ページを作成する
2. `コンテスト名`、`締切日`、`ジャンル`、`公式URL`、`紹介文` を入れる
3. `slug` を英小文字、数字、ハイフンで入れる
4. `ステータス` を `募集中`、`締切間近`、`開催予定` などに設定する
5. 可能なら `サムネイル` に画像URLまたはファイルを入れる
6. `npm run build` で生成ページを確認する

サムネイル推奨:

- 比率: 16:9
- 推奨サイズ: 1200 x 675px 以上
- 形式: JPG / PNG / WebP / Notionのファイル / 外部画像URL
- 未入力または画像読み込み失敗時は `/brand-thumbnail.svg` を表示します
- 詳細ページのOGPは、サムネイルがある場合はその画像、ない場合は `/og-contest.svg` を使います
- 公式ページにOGP画像がない場合は、`public/thumb-*.svg` に16:9のブランドサムネイルを追加し、その公開URLをNotionの `サムネイル` に入れます

締切日を過ぎたコンテストは、Notion側のステータスが `募集中` のままでも、サイト表示上は自動で `終了` 扱いになります。トップページ、一覧、カテゴリ、カレンダーには表示されません。

終了済みコンテストは `/archive` に表示されます。Notion側で `終了` にしたコンテストも、要手動確認でなければアーカイブ対象になります。

## 公開前チェックリスト

- `npm run build` が成功する
- `/` が表示される
- `/contests` が表示される
- `/archive` が表示される
- 主要な詳細ページが表示される
- `/categories/ai-image`、`/categories/ai-video`、`/categories/ai-manga`、`/categories/ai-music`、`/categories/other` が表示される
- `/calendar` が表示される
- `/submit` が表示される
- `/404.html` が表示される
- スマホ幅で横スクロールが出ていない
- CTAボタンが押しやすいサイズになっている
- `SITE_URL/sitemap-index.xml` が開ける
- `SITE_URL/robots.txt` がサイトマップURLを指している
- Cloudflare Pagesに `SITE_URL`、`NOTION_TOKEN`、`NOTION_DATABASE_ID`、`NODE_VERSION=20.19.5` を設定している
- 公開後に `npm run qa:site` が成功する

## GitHub / Deploy準備

通常の更新フロー:

```bash
git add .
git commit -m "Update site"
git push origin main
```

push後、GitHub Actionsの `Deploy to Cloudflare Pages` が成功すれば公開サイトへ反映されます。

## Design / Media Notes

- トップページのヒーローは `public/images/hero-pc.png` / `public/images/hero-mobile.png` を元画像として保持し、表示時は軽量な WebP を優先します。
- WebP版は `public/images/hero-pc.webp` / `public/images/hero-mobile.webp` / `public/images/contest-fallback.webp` です。
- トップページのOGPは `public/images/hero-pc.png` を使用します。Xで共有したときに、サイトの第一印象と同じビジュアルになります。
- Notionでサムネイルが未入力、または旧fallbackの `/brand-thumbnail.svg` の場合、サイト上では `public/images/contest-fallback.png` を表示します。
- コンテスト個別サムネイルは 16:9、推奨 `1200 x 675px` 以上。文字を入れる場合はスマホカードで読める大きさにしてください。
- トップのカードは詳細情報を詰め込みすぎず、タイトル・締切・ジャンル・賞金/賞品・短い紹介を優先します。応募条件や権利まわりは詳細ページで読ませる方針です。
