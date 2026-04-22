# Chat CMS

中小企業向けのセルフ操作型チャットCMSを構築するための Next.js モノリポジトリです。  
要件の正本は [docs/requirements.md](./docs/requirements.md) を参照してください。

## この初期構成で整えたもの

- `Next.js App Router + TypeScript` の開発土台
- `Tailwind CSS` の導入
- `Supabase` 接続ユーティリティの雛形
- `zod` による環境変数バリデーション基盤
- `ESLint / Prettier` の基本設定
- 顧客向け・運営向け・公開サイト向けのルート分離

## ディレクトリ構成

```text
app/          App Router のルート
components/   再利用コンポーネント
docs/         要件・設計メモ
lib/          環境変数・ユーティリティ・外部接続
prompts/      AIプロンプト定義の置き場
supabase/     今後のマイグレーションやRLS設計の置き場
types/        ドメイン型・DB型
```

## ルーティング方針

- `/` : 開発用トップページ
- `/dashboard` : 顧客向け管理画面の入口
- `/admin` : 運営向け管理画面の入口
- `/sites/[siteSlug]` : 公開サイトの表示想定

App Router の route group を使って、URL は保ちながら責務を分けています。

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 環境変数

最低限、以下を設定してください。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

`lib/env.ts` で `zod` バリデーションを通す前提です。

## 今後の実装ガイド

1. `supabase/` に DB マイグレーションと RLS 設計を追加する
2. `types/database.ts` を実 DB スキーマに合わせて更新する
3. `prompts/` にチャット解釈用のマスタープロンプトを追加する
4. `app/(customer)` 配下から顧客向け画面を段階的に実装する
5. `app/(admin)` 配下で運営管理画面を実装する

## 開発メモ

- 今回は土台構成のみで、認証・DB マイグレーション・実画面機能は未実装です。
- Supabase / OpenAI は差し替えやすいように接続点だけを分離しています。
