# Release Checklist

MVP を確認して共有・レビュー・デモしやすくするための最小チェックリストです。

## 1. 環境と依存関係

- `.env.local` が最新の `.env.example` と一致している
- Public 変数と server-only 変数を混同していない
- `npm install` 後に依存関係エラーがない

## 2. DB と Supabase

- migration が最新まで適用済み
- Auth が有効
- `public.users.auth_user_id` と Auth user が対応している
- Storage バケット `site-assets` が存在する
- RLS の smoke check を実行済み

## 3. Claude / Anthropic

- `ANTHROPIC_API_KEY` を使う場合は設定済み
- 未設定時でも fallback 動作で主要フローが壊れない

## 4. GA4

- GA4 を使う site では `analytics_provider = ga4`
- `ga4_property_id` が設定済み
- `GA4_CLIENT_EMAIL` と `GA4_PRIVATE_KEY` が設定済み
- `/dashboard/analytics` から接続確認を実行済み
- `ok` 以外の場合、理由を把握している

## 5. 顧客向け主要フロー

- `/login` からログインできる
- `/dashboard/chat` で文言変更の最小フローが通る
- `/dashboard/chat` で画像差し替えの最小フローが通る
- `/dashboard/chat` でお知らせ作成の最小フローが通る
- 承認後に新しい `site_version` が作成される
- `/dashboard/news` で通常投稿もできる
- `/dashboard/assets` で画像アップロードできる
- `/dashboard/history` で履歴詳細とロールバックが使える
- `/dashboard/analytics` が表示できる
- `/dashboard/settings` で analytics 設定を保存できる

## 6. 公開サイト

- `sites.current_version_id` がある site で公開表示できる
- `site_versions.snapshot_json` から描画される
- 承認前プレビューと公開表示で大きな差がない

## 7. 認証と境界

- 未ログインで protected route に入れない
- 顧客が他社 site を開けない
- 管理者ルートは顧客から見えない
- API で ownership check が効いている
- RLS で他社データが見えない

## 8. コード品質

- `npm run typecheck`
- `npm run lint`
- `npm run test`

上の 3 つが通っている

## 9. 共有前メモ

- デモ用 site / user / property の準備がある
- fallback 表示なのか GA4 実データなのか説明できる
- 既知の未実装範囲を共有できる
