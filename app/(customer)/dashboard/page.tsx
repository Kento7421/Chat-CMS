import Link from "next/link";
import { SectionCard } from "@/components/layout/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[28px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur sm:p-8">
        <StatusBadge>Customer Area</StatusBadge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">顧客向けダッシュボード</h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
            チャット更新、お知らせ投稿、画像管理、履歴確認をここから進められます。
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Link href="/dashboard/chat">
          <SectionCard
            title="チャット更新"
            description="自然文から候補提示、承認、公開まで進めるメイン導線です。"
          />
        </Link>
        <SectionCard
          title="公開サイト"
          description="snapshot を正本にした公開状態の確認や、今後の導線追加に備える領域です。"
        />
        <Link href="/dashboard/news">
          <SectionCard
            title="お知らせ投稿"
            description="タイトルと本文から news_posts と site_version をまとめて作成します。"
          />
        </Link>
        <Link href="/dashboard/assets">
          <SectionCard
            title="画像管理"
            description="Storage 保存と metadata 管理を行い、Asset ID をサイト更新に流用できます。"
          />
        </Link>
        <Link href="/dashboard/history">
          <SectionCard
            title="履歴と復元"
            description="Version 一覧、差分詳細、ロールバックを確認できます。"
          />
        </Link>
      </section>
    </div>
  );
}
