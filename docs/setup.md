# Setup

このドキュメントは、MVP を新規開発者がローカルで起動して確認するための手順です。

## 前提

- Node.js 20 以上
- npm
- Supabase プロジェクト
- 必要なら Claude / Anthropic API key
- 必要なら GA4 service account

## 1. リポジトリを準備する

```bash
npm install
```

次に `.env.example` を元に `.env.local` を作成します。

## 2. 環境変数を設定する

### Public

これらは client 側でも参照されます。

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_ASSETS_BUCKET`

### Server-only

これらは server 側だけで使います。

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ASSETS_BUCKET`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `SITE_PREVIEW_ORIGIN`
- `GA4_CLIENT_EMAIL`
- `GA4_PRIVATE_KEY`
- `GA4_TOKEN_URI`
- `GA4_API_BASE_URL`

### 補足

- `ANTHROPIC_API_KEY` が未設定でも、チャット解釈は heuristic fallback で最低限動きます
- GA4 連携を使わない場合は `GA4_*` を未設定でも構いません
- `GA4_PRIVATE_KEY` は改行を `\n` 形式で入れても動くようにしています

## 3. Supabase を準備する

### 必須設定

- Auth を有効化する
- `public.users.auth_user_id` と Supabase Auth の `auth.users.id` が対応するようにする
- Storage バケット `site-assets` を作る

### migration を適用する

推奨は Supabase CLI です。

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

CLI を使わない場合は、`supabase/migrations/` の SQL を番号順に適用してください。

適用対象:

1. `202604220001_initial_chat_cms_schema.sql`
2. `202604230001_add_rls_for_core_content_tables.sql`
3. `202604230002_add_rls_for_chat_and_audit_tables.sql`
4. `202604230003_add_site_analytics_config.sql`

### RLS を確認する

`supabase/policies/rls_smoke_checks.sql` を Supabase Dashboard の Policy Tester で実行します。

確認するユーザー:

- client A の顧客ユーザー
- client B の顧客ユーザー
- `operator_admin`

期待結果:

- 顧客は自社データだけ見える
- `operator_admin` は全件見える

## 4. 外部サービスの前提設定

### Supabase

- Auth のユーザーが `public.users` に対応している
- Storage バケット名が `.env.local` と一致している
- RLS migration が適用済み

### Claude / Anthropic

- `ANTHROPIC_API_KEY` を設定すると `/api/chat/interpret` で構造化出力の AI 解釈を使えます
- 未設定時は fallback へ自動で戻ります

### GA4

- `sites.analytics_provider = ga4`
- `sites.ga4_property_id` を設定
- `GA4_CLIENT_EMAIL` と `GA4_PRIVATE_KEY` を設定
- 必要なら `/dashboard/settings` から site 設定を変更
- `/dashboard/analytics` から接続確認を実行

## 5. 起動する

```bash
npm run dev
```

通常は [http://localhost:3000](http://localhost:3000) を開きます。

## 6. 基本確認コマンド

```bash
npm run typecheck
npm run lint
npm run test
```

## 7. 最低限の動作確認ポイント

- `/login` から顧客ログインできる
- `/dashboard` へ入れる
- `/dashboard/chat` でチャット更新が使える
- `/dashboard/news` でお知らせ投稿できる
- `/dashboard/assets` で画像アップロードできる
- `/dashboard/history` で履歴とロールバックを確認できる
- `/dashboard/analytics` でアクセス状況が見える
- `/dashboard/settings` で analytics 設定を変更できる
