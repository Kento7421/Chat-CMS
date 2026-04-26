# Chat CMS

中小企業向けのセルフ操作型チャット CMS の MVP です。  
要件の正本は [docs/requirements.md](/C:/Users/kento/Downloads/Chat-CMS/docs/requirements.md) を参照してください。

## 現在のMVP範囲

- 顧客向けダッシュボードと管理導線の土台
- Supabase Auth 前提の認証と ownership check
- `site_versions` を中心にした版管理とロールバック
- チャット更新フロー
- お知らせ投稿と画像アップロード
- 公開サイト描画
- アクセス状況の最小表示
- GA4 接続確認と site ごとの analytics 設定
- 主要テーブルの read RLS

## まず見るドキュメント

- セットアップ手順: [docs/setup.md](/C:/Users/kento/Downloads/Chat-CMS/docs/setup.md)
- リリース前チェック: [docs/release-checklist.md](/C:/Users/kento/Downloads/Chat-CMS/docs/release-checklist.md)
- Supabase 補足: [supabase/README.md](/C:/Users/kento/Downloads/Chat-CMS/supabase/README.md)

## 開発コマンド

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
```

## 環境変数

`.env.example` に必要な項目をまとめています。  
`NEXT_PUBLIC_` 付きは client でも参照される公開変数、それ以外は server-only 前提です。

主な区分:

- App: アプリ名、ローカル URL
- Supabase public: URL、anon key、公開バケット名
- Supabase server: service role key、サーバー側バケット名
- Claude / Anthropic: チャット解釈用。未設定時は fallback 解釈あり
- GA4: analytics 実データ連携用。未設定でも fallback 表示は継続

## 補足

- DB migration は `supabase/migrations/` にあります
- RLS の smoke check query は `supabase/policies/rls_smoke_checks.sql` にあります
- 本番デプロイ手順そのものはまだ含めていません
