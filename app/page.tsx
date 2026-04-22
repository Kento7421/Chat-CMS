import Link from "next/link";
import { SectionCard } from "@/components/layout/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

const routeCards = [
  {
    href: "/dashboard",
    title: "顧客ダッシュボード",
    description: "顧客向けの更新体験を載せる入口。"
  },
  {
    href: "/admin",
    title: "運営管理画面",
    description: "顧客管理、契約管理、監査ログを載せる入口。"
  },
  {
    href: "/sites/demo-company",
    title: "公開サイト",
    description: "テンプレートからレンダリングされる公開面の入口。"
  }
];

const setupCards = [
  "Next.js App Router / TypeScript の土台",
  "Tailwind CSS と共通スタイル",
  "Supabase 接続ユーティリティ",
  "zod による env バリデーション",
  "ESLint / Prettier の基本設定",
  "docs/requirements.md と README 整備"
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-white/50 bg-hero-glow px-6 py-10 shadow-panel backdrop-blur sm:px-10">
        <div className="max-w-3xl space-y-4">
          <StatusBadge>Scaffold Ready</StatusBadge>
          <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            MVP版チャットCMSの初期構成
          </h1>
          <p className="text-base leading-7 text-slate-700 sm:text-lg">
            顧客向け画面、運営画面、公開サイトを同じリポジトリで育てるための
            App Router 土台です。認証や機能本体はまだ載せず、構造と接続点だけを
            先に整えています。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-full bg-sea px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700"
            >
              顧客向けを見る
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-400"
            >
              運営向けを見る
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {routeCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <SectionCard
              title={card.title}
              description={card.description}
              footer="ルートのプレースホルダを開く"
            />
          </Link>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="今あるもの"
          description="この段階で開発を始めやすくするため、先に共通ルールを揃えています。"
        >
          <ul className="space-y-3 text-sm text-slate-700">
            {setupCards.map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3"
              >
                {item}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="次に載せるもの"
          description="仕様書の Phase 1 に沿って、次は認証・テンプレート・版管理へ進む想定です。"
        >
          <div className="space-y-3 text-sm text-slate-700">
            <p className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
              `supabase/` にマイグレーションを追加
            </p>
            <p className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
              `app/(customer)` にログイン後ダッシュボードを実装
            </p>
            <p className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
              `site_versions.snapshot_json` を基準に公開面をレンダリング
            </p>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
