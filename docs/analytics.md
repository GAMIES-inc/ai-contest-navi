# AIコンテストナビ アクセス解析・送客計測

AIコンテストナビでは、Cloudflare Web Analytics と Cloudflare D1 を組み合わせて、サイト全体の閲覧状況とコンテストごとの公式ページ送客数を確認できるようにします。

## 計測できること

- サイト全体PV
- ページ別PV
- コンテスト別詳細PV
- ガイド記事PV
- 掲載ページPV
- 公式ページ送客クリック
- 信頼できる公式ページ送客クリック
- 要確認クリック / 怪しいクリック
- 詳細PVに対する公式送客クリック率
- UTM別流入
- UTM別送客クリック
- 日別推移

## Cloudflare Web Analytics

Cloudflare Web Analytics は、サイト全体のPVや訪問者傾向を見るために使います。

1. Cloudflare ダッシュボードを開く
2. `Web Analytics` を開く
3. 対象サイトを追加する
4. 発行されたトークンを Cloudflare Pages の環境変数 `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` に設定する
5. 再デプロイする

トークンを設定すると、共通レイアウトから Cloudflare Web Analytics のスニペットが挿入されます。

## D1セットアップ

公式ページ送客クリックやコンテスト別PVは、D1に保存します。

```bash
wrangler d1 create ai_contest_navi_analytics
```

ローカルでマイグレーションを確認する場合:

```bash
wrangler d1 migrations apply ai_contest_navi_analytics --local
```

Cloudflare上のD1へ適用する場合:

```bash
wrangler d1 migrations apply ai_contest_navi_analytics --remote
```

Cloudflare Pagesの管理画面で、PagesプロジェクトにD1バインディングを追加してください。

- Binding name: `ANALYTICS_DB`
- Database: `ai_contest_navi_analytics`

## wrangler設定例

本番DB IDは `wrangler.toml` に直接入れず、必要な場合は `wrangler.example.toml` をコピーして実値を入れてください。

```toml
[[d1_databases]]
binding = "ANALYTICS_DB"
database_name = "ai_contest_navi_analytics"
database_id = "ここにCloudflareで作成されたdatabase_idを入れる"
```

## 環境変数

Cloudflare Pagesに設定する値:

```txt
PUBLIC_ENABLE_FIRST_PARTY_ANALYTICS=true
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=Cloudflare Web Analyticsのトークン
ANALYTICS_ADMIN_TOKEN=任意の長いランダム文字列
NOTION_TOKEN=Notion APIトークン
NOTION_DATABASE_ID=Notion DB ID
SITE_URL=https://ai-contest-navi.pages.dev
NODE_VERSION=20.19.5
```

`PUBLIC_ENABLE_FIRST_PARTY_ANALYTICS=false` または未設定の場合、ページビュー送信スクリプトは挿入されません。

## 集計API

集計APIは認証必須です。`Authorization: Bearer <ANALYTICS_ADMIN_TOKEN>` を付けて呼び出します。

`from` / `to` の日付指定と `daily` 集計は、レポート用途に合わせて `Asia/Tokyo` 基準で扱います。DB内の `created_at` はUTCのまま保存しますが、summary APIでは指定日の日本時間 00:00:00 から 23:59:59 までをUTCに変換して集計し、日別の `date` も日本時間の日付として返します。

JSON取得:

```bash
curl -H "Authorization: Bearer $ANALYTICS_ADMIN_TOKEN" \
  "https://ai-contest-navi.pages.dev/api/analytics/summary?from=2026-06-01&to=2026-06-30"
```

コンテスト別取得:

```bash
curl -H "Authorization: Bearer $ANALYTICS_ADMIN_TOKEN" \
  "https://ai-contest-navi.pages.dev/api/analytics/summary?contest=jacc-super-dimensional-ai-soccer-2026"
```

CSV取得:

```bash
curl -H "Authorization: Bearer $ANALYTICS_ADMIN_TOKEN" \
  "https://ai-contest-navi.pages.dev/api/analytics/summary?format=csv"
```

返る主な値:

- `totals.pageViews`
- `totals.outboundClicks`
- `totals.trustedOutboundClicks`
- `totals.reviewOutboundClicks`
- `totals.suspiciousOutboundClicks`
- `clickTrust[]`
- `contests[].detailPageViews`
- `contests[].officialClicks`
- `contests[].trustedOfficialClicks`
- `contests[].reviewOfficialClicks`
- `contests[].suspiciousOfficialClicks`
- `contests[].clickThroughRate`
- `contests[].trustedClickThroughRate`
- `campaigns[].pageViews`
- `campaigns[].outboundClicks`
- `campaigns[].trustedOutboundClicks`

`outboundClicks` / `officialClicks` は全記録の参考値です。主催者向けに「送客数」として出す場合は、原則として `trustedOutboundClicks` / `trustedOfficialClicks` を使います。

クリック信頼度:

- `trusted`: botではなく、AIコンテストナビ上のページから `/go/` がクリックされたと見なせるもの
- `review`: UTMやreferrerはあるが、サイト上クリックとしては確定しきれないもの
- `suspicious`: bot判定、またはページ文脈なしで `/go/` だけが直接叩かれたもの

自分やAI編集時の確認を除外したい場合は、本番URLに `?no_track=1` を付けて一度開きます。同じブラウザでは `localStorage` に除外設定が残り、ページビューと `/go/` クリックの両方を送信しません。解除する場合は `?track=1` または `?no_track=0` を付けて開きます。

## UTM運用例

X投稿などからの流入効果を見るため、投稿URLにはUTMを付けてください。

コンテスト紹介投稿:

```txt
?utm_source=x&utm_medium=social&utm_campaign=jacc_2026_intro
```

締切3日前リマインド:

```txt
?utm_source=x&utm_medium=social&utm_campaign=jacc_2026_deadline_3days
```

締切前日リマインド:

```txt
?utm_source=x&utm_medium=social&utm_campaign=jacc_2026_deadline_1day
```

週間まとめ:

```txt
?utm_source=x&utm_medium=social&utm_campaign=weekly_deadline_roundup
```

## 管理者確認時の除外

自分で表示確認するときは、URLに `?no_track=1` を付けるとページビューや公式クリックを記録しません。

例:

```txt
https://ai-contest-navi.pages.dev/contests/jacc-super-dimensional-ai-soccer-2026/?no_track=1
```

## Cloudflare本番設定チェックリスト

本番運用に入るときは、この順番で進めてください。

### 1. D1データベースを作成する

```bash
wrangler d1 create ai_contest_navi_analytics
```

実行後に表示される `database_id` は、Cloudflare側のD1設定確認用に控えておきます。リポジトリの `wrangler.toml` には本番DB IDを直接入れない運用にしています。

### 2. Cloudflare PagesにD1 bindingを追加する

Cloudflare管理画面で対象のPagesプロジェクトを開きます。

1. `Workers & Pages`
2. `ai-contest-navi`
3. `Settings`
4. `Functions`
5. `D1 database bindings`
6. `Add binding`

設定値:

```txt
Variable name: ANALYTICS_DB
D1 database: ai_contest_navi_analytics
```

Preview / Production の両方で使う場合は、両方に同じbindingを設定してください。

### 3. Cloudflare Pagesの環境変数を設定する

Cloudflare Pagesの `Settings` → `Environment variables` に以下を追加します。

```txt
PUBLIC_ENABLE_FIRST_PARTY_ANALYTICS=true
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=Cloudflare Web Analyticsのトークン（任意）
ANALYTICS_ADMIN_TOKEN=任意の長いランダム文字列
NOTION_TOKEN=Notion APIトークン
NOTION_DATABASE_ID=Notion DB ID
SITE_URL=https://ai-contest-navi.pages.dev
NODE_VERSION=20.19.5
```

`ANALYTICS_ADMIN_TOKEN` はフロントに出ないサーバー側の値です。外部に貼らないでください。

### 4. D1マイグレーションを適用する

ローカルのターミナルで実行します。

```bash
wrangler d1 migrations apply ai_contest_navi_analytics --remote
```

適用後、テーブルがあるか確認します。

```bash
wrangler d1 execute ai_contest_navi_analytics --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

`page_views` と `outbound_clicks` が出ればOKです。

### 5. 再デプロイする

GitHub Actionsで再デプロイする場合:

```bash
git push origin main
```

Cloudflare Pagesの管理画面で再デプロイする場合は、対象デプロイから `Retry deployment` または `Redeploy` を実行します。

### 6. UTM付きURLで詳細ページを開く

```txt
https://ai-contest-navi.pages.dev/contests/jacc-super-dimensional-ai-soccer-2026/?utm_source=x&utm_medium=social&utm_campaign=jacc_2026_intro
```

### 7. page_viewsを確認する

```bash
wrangler d1 execute ai_contest_navi_analytics --remote --command "SELECT path, page_type, page_id, utm_source, utm_medium, utm_campaign, created_at FROM page_views ORDER BY created_at DESC LIMIT 5;"
```

期待値:

```txt
path: /contests/jacc-super-dimensional-ai-soccer-2026/
page_type: contest
page_id: jacc-super-dimensional-ai-soccer-2026
utm_source: x
utm_medium: social
utm_campaign: jacc_2026_intro
```

### 8. 公式CTAをクリックする

詳細ページ内の `公式で応募条件を確認する` をクリックします。リンクは `/go/jacc-super-dimensional-ai-soccer-2026?...` を経由し、公式ページへ遷移します。

### 9. outbound_clicksを確認する

```bash
wrangler d1 execute ai_contest_navi_analytics --remote --command "SELECT contest_slug, contest_title, link_key, source_path, utm_source, utm_medium, utm_campaign, created_at FROM outbound_clicks ORDER BY created_at DESC LIMIT 5;"
```

期待値:

```txt
contest_slug: jacc-super-dimensional-ai-soccer-2026
link_key: official
source_path: /contests/jacc-super-dimensional-ai-soccer-2026/
utm_source: x
utm_medium: social
utm_campaign: jacc_2026_intro
```

### 10. summary APIでレポート値を見る

```bash
curl -H "Authorization: Bearer $ANALYTICS_ADMIN_TOKEN" \
  "https://ai-contest-navi.pages.dev/api/analytics/summary?contest=jacc-super-dimensional-ai-soccer-2026&from=2026-06-01&to=2026-06-30"
```

確認する値:

```txt
contests[0].detailPageViews
contests[0].officialClicks
contests[0].clickThroughRate
campaigns[].pageViews
campaigns[].outboundClicks
daily[].pageViews
daily[].outboundClicks
period.timezone = Asia/Tokyo
```

### 11. Authorizationなしで401になるか確認する

```bash
curl -i "https://ai-contest-navi.pages.dev/api/analytics/summary?contest=jacc-super-dimensional-ai-soccer-2026"
```

期待値:

```txt
HTTP/2 401
{"error":"Unauthorized"}
```

### 12. no_track=1で記録されないか確認する

以下を開きます。

```txt
https://ai-contest-navi.pages.dev/contests/jacc-super-dimensional-ai-soccer-2026/?no_track=1&utm_source=x&utm_medium=social&utm_campaign=test_no_track
```

そのページから公式CTAをクリックします。
その後、D1で `utm_campaign = 'test_no_track'` が記録されていないことを確認します。

```bash
wrangler d1 execute ai_contest_navi_analytics --remote --command "SELECT COUNT(*) AS count FROM page_views WHERE utm_campaign='test_no_track';"
wrangler d1 execute ai_contest_navi_analytics --remote --command "SELECT COUNT(*) AS count FROM outbound_clicks WHERE utm_campaign='test_no_track';"
```

期待値はいずれも `0` です。

### 13. D1書き込み失敗時でも/goが遷移することを確認する

D1 bindingが未設定のPreview環境や、D1を一時的に外したPreviewデプロイで以下を開きます。

```txt
https://<preview-url>/go/jacc-super-dimensional-ai-soccer-2026?link=official&from=test
```

期待値:

- D1書き込みができなくても公式ページへ遷移する
- 画面上にSQLエラーや内部エラーが出ない

本番のD1 bindingを外す必要はありません。確認はPreview環境で行ってください。

### 14. 存在しないslugが任意URLに飛ばないことを確認する

```txt
https://ai-contest-navi.pages.dev/go/not-found-test?url=https://example.com
```

期待値:

- `https://example.com` には飛ばない
- `/contests` へ戻る
- Open Redirectになっていない

## 注意

- IPアドレスは保存しません。
- Cookieや個人識別IDは使いません。
- User-Agentは保存せず、簡易的なbot判定にだけ使用します。
- `/go/:slug` は任意URLを受け取らず、登録済みコンテストの公式URLだけへリダイレクトします。

## 主催者向けレポートテンプレート

summary APIで取得したJSONをもとに、主催者には以下のような形で報告できます。

```txt
掲載レポート：JACC杯 超次元AIサッカー2026
掲載期間：2026年6月1日〜6月30日

コンテスト詳細PV：320
信頼できる公式ページ送客クリック：44
要確認/怪しいクリック：4
信頼できる公式送客率：13.8%

X経由流入：120
X経由公式送客クリック：18
締切リマインド投稿経由流入：42
締切リマインド投稿経由公式送客クリック：7

補足：
掲載情報はAIコンテストナビ内の詳細ページ閲覧数と、公式ページへの遷移クリック数を集計したものです。
日別集計は日本時間（Asia/Tokyo）基準です。
```

数字の対応:

- コンテスト詳細PV: `contests[].detailPageViews`
- 信頼できる公式ページ送客クリック: `contests[].trustedOfficialClicks`
- 要確認クリック: `contests[].reviewOfficialClicks`
- 怪しいクリック: `contests[].suspiciousOfficialClicks`
- 信頼できる公式送客率: `contests[].trustedClickThroughRate`
- 全公式クリック参考値: `contests[].officialClicks`
- X経由流入: `campaigns[]` の `utmSource = "x"` の `pageViews`
- X経由公式送客クリック: `campaigns[]` の `utmSource = "x"` の `trustedOutboundClicks`
- 締切リマインド投稿経由流入: 該当 `utmCampaign` の `pageViews`
- 締切リマインド投稿経由公式送客クリック: 該当 `utmCampaign` の `trustedOutboundClicks`

## コンテスト別summary APIで見られる値

コンテスト別に見る場合は `contest` パラメータを付けます。この場合、`contests` だけでなく、`campaigns` と `daily` も対象コンテストに絞り込まれます。

```bash
curl -H "Authorization: Bearer $ANALYTICS_ADMIN_TOKEN" \
  "https://ai-contest-navi.pages.dev/api/analytics/summary?contest=jacc-super-dimensional-ai-soccer-2026&from=2026-06-01&to=2026-06-30"
```

このレスポンスで、以下が確認できます。

- 詳細PV: `contests[].detailPageViews`
- 公式クリック数: `contests[].officialClicks`
- 信頼できる公式クリック数: `contests[].trustedOfficialClicks`
- 要確認クリック数: `contests[].reviewOfficialClicks`
- 怪しいクリック数: `contests[].suspiciousOfficialClicks`
- 公式送客率: `contests[].clickThroughRate`
- 信頼できる公式送客率: `contests[].trustedClickThroughRate`
- UTM別PV: `campaigns[].pageViews`
- UTM別公式クリック: `campaigns[].outboundClicks`
- UTM別信頼公式クリック: `campaigns[].trustedOutboundClicks`
- 日別PV: `daily[].pageViews`
- 日別公式クリック: `daily[].outboundClicks`
- 日別信頼公式クリック: `daily[].trustedOutboundClicks`
- 日別集計の基準タイムゾーン: `period.timezone`

`period.timezone` は `Asia/Tokyo` です。DB保存はUTCですが、summary APIの期間指定と `daily` は日本時間基準で返します。
