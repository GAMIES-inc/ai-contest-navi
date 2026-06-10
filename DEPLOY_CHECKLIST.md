# AIコンテストナビ 公開チェックリスト

## 1. GitHub

このフォルダはすでにGitコミット済みです。

GitHubで新しいリポジトリを作ったら、以下を実行します。

```bash
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

## 2. Cloudflare Pages

Cloudflare PagesでGitHubリポジトリを接続します。

- Framework preset: `Astro`
- Build command: `npm run build`
- Output directory: `dist`
- Node version: `20.19.5`
- Production branch: `main`

環境変数:

- `SITE_URL`: Cloudflare Pagesの公開URL
- `NOTION_TOKEN`: Notion Integration Token
- `NOTION_DATABASE_ID`: Notion DB ID
- `NODE_VERSION`: `20.19.5`

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
