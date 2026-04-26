# Supabase

このディレクトリには、Supabase 向けの DB 変更と運用メモを置きます。

主な内容:

- SQL migration
- Row Level Security
- seed data
- storage 設定メモ

現在の構成:

- `migrations/`
- `seed/`
- `policies/`
- `functions/`

## RLS

read RLS は次の migration で段階的に追加しています。

- `migrations/202604230001_add_rls_for_core_content_tables.sql`
- `migrations/202604230002_add_rls_for_chat_and_audit_tables.sql`

対象:

- `sites`
- `site_versions`
- `version_changes`
- `news_posts`
- `assets`
- `chat_sessions`
- `chat_messages`
- `suggestion_sets`
- `change_sets`
- `audit_logs`

方針:

- `auth.uid()` と `public.users.auth_user_id` の対応から現在ユーザーを特定します
- 顧客ユーザーは自分の `client_id` に紐づく行だけ参照できます
- `operator_admin` は全件参照できます
- chat 系は `chat_sessions` や `change_sets`、`site_id` をたどって帰属確認します
- `audit_logs` は `site_id` を優先し、なければ `client_id`、最後に `actor_user_id` を見て判定します
- 今回は読み取りポリシーを優先し、既存アプリの service role 利用を壊さない形にしています

確認手順:

1. migration を適用する
2. Supabase Dashboard の Policy Tester で顧客ユーザー A を選ぶ
3. `policies/rls_smoke_checks.sql` の query を実行し、client A の行だけ見えることを確認する
4. 別 client の顧客ユーザー B でも同様に確認する
5. `operator_admin` で全件参照できることを確認する
