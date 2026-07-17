# ゆるコンテストなび 公開チェックリスト

## 1. GitHub

このフォルダはすでにGitコミット済みです。

GitHubで新しいリポジトリを作ったら、以下を実行します。

```bash
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

## 2. Cloudflare Pages

現在の公開サイトはCloudflare Pagesへ直接デプロイ済みです。

GitHubからの自動デプロイは `.github/workflows/deploy-cloudflare-pages.yml` で行います。

- Framework preset: `Astro`
- Build command: `npm run build`
- Output directory: `dist`
- Node version: `24.14.0`
- Production branch: `main`

Cloudflare Pages側の環境変数:

- `SITE_URL`: Cloudflare Pagesの公開URL
- `NOTION_TOKEN`: Notion Integration Token
- `NOTION_DATABASE_ID`: Notion DB ID
- `NODE_VERSION`: `24.14.0`

GitHub Actions secrets:

- `SITE_URL`: 設定済み
- `NOTION_TOKEN`: 設定済み
- `NOTION_DATABASE_ID`: 設定済み
- `CLOUDFLARE_ACCOUNT_ID`: 設定済み
- `CLOUDFLARE_API_TOKEN`: CloudflareでAPIトークンを作成して追加する

`CLOUDFLARE_API_TOKEN` はCloudflare dashboardの My Profile > API Tokens から作成します。
必要権限は Account > Cloudflare Pages > Edit です。

## 3. 公開後QA

公開URLが決まったら、ローカルで以下を実行します。

```powershell
$env:SITE_URL="https://公開URL"
npm run qa:site
```

確認対象:

- トップ
- コンテスト一覧
- 終了済みアーカイブ
- 詳細ページ
- カテゴリページ
- カレンダー
- 掲載について
- 404
- robots.txt
- sitemap-index.xml
- sitemap-0.xml
- OGP画像
- canonical
- og:url
- og:image

## 4. SNS OGP確認

公開後にXやSlackへURLを貼り、カード画像が出るか確認します。

見るURL:

- `/`
- `/contests/first-ai-manga-contest`
- `/contests/aaiff-2026`
- `/archive`

## 5. Notion運用

新しいコンテストを追加したら:

```bash
npm run notion:sync-slugs
npm run notion:sync-thumbnails
npm run build
```

slugは公開後に変えないでください。
