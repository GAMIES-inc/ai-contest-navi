# AWS Amplify Hosting デプロイ手順

## 構成

- リポジトリ: `https://github.com/shigotoyametai/ai-contest-navi`
- 対象ブランチ: `main`
- フレームワーク: Astro（static出力）
- Node.js: 24系
- パッケージ管理: npm（`npm ci`）
- ビルドコマンド: `npm run build`
- 出力先: `dist`
- ビルド設定: リポジトリ直下の `amplify.yml` を使用

AWS Amplify BackendやSSR用アダプターは使用しません。

## Amplifyアプリの作成

1. AWS Amplify Hostingで「新しいアプリをデプロイ」を選び、GitHubを接続します。
2. `shigotoyametai/ai-contest-navi` の `main` ブランチだけを接続します。
3. 自動ビルドを有効にし、`main` へのpushを継続デプロイの起点にします。
4. ビルド設定には、リポジトリ内の `amplify.yml` が読み込まれていることを確認します。
5. 初回デプロイの前に、次の環境変数をAmplifyの「環境変数」で登録します。

## Amplifyへ登録する環境変数

| 変数名 | 必須 | 分類 | 用途 |
| --- | --- | --- | --- |
| `SITE_URL` | 必須 | 公開設定値 | canonical、OGP、sitemap、robotsの基準URL。`https://contest.gamies.io` を設定 |
| `NOTION_TOKEN` | 必須 | 秘密情報 | ビルド時のNotion API接続 |
| `NOTION_DATABASE_ID` | 必須 | 非公開の識別子 | ビルド時に参照するNotionデータベース |
| `PUBLIC_ENABLE_FIRST_PARTY_ANALYTICS` | 任意 | 公開設定値 | Amplifyでは未設定または `false`。Cloudflare Functions用の計測を無効化 |

次の項目はAmplifyへ登録しません。

- `NODE_VERSION`: `amplify.yml` の `nvm use 24` で固定します。
- `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`: Cloudflare Web Analytics専用です。
- `ANALYTICS_ADMIN_TOKEN`: Cloudflare Functionsの集計API専用の秘密情報です。
- `CLOUDFLARE_API_TOKEN`: GitHub ActionsからCloudflare Pagesへデプロイするための秘密情報です。
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflareデプロイ用のアカウント識別子です。
- `ANALYTICS_DB`: Cloudflare D1のバインディングであり、Amplifyの環境変数ではありません。
- `GITHUB_STEP_SUMMARY`: GitHub Actionsが実行時に提供する値です。

環境変数の実値は、リポジトリや `amplify.yml` へ記載しないでください。

## Notion公開データの予備スナップショット

AmplifyでNotion接続に一時的な問題があってもページ数が減らないよう、公開対象のコンテストだけを `src/data/contests.snapshot.json` に保持しています。

- 通常は `NOTION_TOKEN` と `NOTION_DATABASE_ID` を使ったNotion取得が優先されます。
- DB更新後は `npm run notion:sync-fallback` を実行してからcommit・pushします。
- スナップショットには公開ページ用の項目だけを保存し、トークンやNotionページIDは含めません。
- この仕組みはNotion接続の代替ではなく、ビルド失敗時の表示欠けを防ぐための予備経路です。

## Amplify仮URLでの確認

初回ビルド完了後、Amplifyが発行した `amplifyapp.com` のURLで次を確認します。

1. `/`、`/contests`、`/calendar`、`/guides`、`/archive`、`/submit` が表示される。
2. `/contests/[slug]` と `/guides/[slug]` を直接開いても404にならない。
3. コンテスト詳細の公式ページボタンが、外部の公式URLを開く。
4. 画像、CSS、JavaScriptが欠けず、PCとスマートフォンで表示できる。
5. `/sitemap-index.xml` と `/robots.txt` が取得できる。
6. HTMLのcanonicalとOGP URLが `https://contest.gamies.io` を指している。
7. ビルドログにトークンなどの秘密情報が表示されていない。

## カスタムドメイン

仮URLでの確認が完了してから、`main` ブランチへ `contest.gamies.io` だけを接続します。

1. Amplify Hostingの「カスタムドメイン」で `gamies.io` を追加します。
2. ルートドメインを除外し、サブドメイン `contest` だけを `main` に割り当てます。
3. Amplifyが案内する検証用DNSレコードと接続用DNSレコードを設定します。
4. `gamies.io` と `www.gamies.io` の既存レコード・接続先は変更しません。
5. SSL証明書の発行とドメインの有効化が完了するまで待ちます。

## 初回公開後の確認

1. `https://contest.gamies.io/` と主要ページを直接開きます。
2. `https://contest.gamies.io/sitemap-index.xml` と `https://contest.gamies.io/robots.txt` を確認します。
3. canonical、OGP、画像、公式ページリンク、スマートフォン表示を確認します。
4. `main` に小さな確認用変更をpushし、Amplifyが自動ビルド・公開することを確認します。
5. 上記がすべて正常になるまで、Cloudflare Pagesと `.github/workflows/deploy-cloudflare-pages.yml` は停止・削除しません。

## Amplify移行確認後の作業

Amplifyでの継続デプロイとカスタムドメイン公開が安定した後、別作業として次を行います。

- 旧Cloudflare Pages URLから新URLへのリダイレクト方針を決める。
- Cloudflare側のアクセス計測を新環境でどう置き換えるか決める。
- リダイレクト確認後にCloudflare Pagesの自動デプロイ停止を検討する。
- `.github/workflows/deploy-cloudflare-pages.yml` の削除・無効化は、移行完了確認後に行う。
