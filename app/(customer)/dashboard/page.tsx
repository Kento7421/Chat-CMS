import Link from "next/link";
import { SectionCard } from "@/components/layout/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

const dashboardGroups = [
  {
    title: "サイト編集",
    description: "文章変更、画像管理、履歴確認など、サイト本体の更新をここから進めます。",
    items: [
      {
        href: "/dashboard/chat",
        title: "チャット更新",
        description: "自然文で変更を伝えて、候補確認から公開まで進めます。"
      },
      {
        href: "/dashboard/assets",
        title: "画像管理",
        description: "サイトで使う画像を追加して、差し替え用の素材を整えます。"
      },
      {
        href: "/dashboard/history",
        title: "履歴と復元",
        description: "変更履歴の確認、差分の確認、過去版への復元を行えます。"
      }
    ]
  },
  {
    title: "投稿",
    description: "お知らせの作成と公開を行います。",
    items: [
      {
        href: "/dashboard/news",
        title: "お知らせ投稿",
        description: "タイトルと本文を登録して、公開サイトへ反映できます。"
      }
    ]
  },
  {
    title: "アクセス状況",
    description: "ホームページがどれくらい見られているかをシンプルに確認できます。",
    items: [
      {
        href: "/dashboard/analytics",
        title: "アクセス状況を見る",
        description: "今月の訪問数、先月比、人気ページを確認できます。"
      },
      {
        href: "/dashboard/settings",
        title: "アクセス設定",
        description: "簡易データと GA4 の切り替え、GA4 プロパティ ID の設定を行えます。"
      }
    ]
  }
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[28px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur sm:p-8">
        <StatusBadge>Customer Area</StatusBadge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            顧客向けダッシュボード
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
            サイト編集、投稿、アクセス状況の確認をひとつの場所で進められます。必要な作業を選んで、そのまま更新フローへ進んでください。
          </p>
        </div>
      </section>

      <div className="space-y-6">
        {dashboardGroups.map((group) => (
          <SectionCard
            key={group.title}
            title={group.title}
            description={group.description}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[24px] border border-slate-200 bg-white/70 px-5 py-5 transition hover:-translate-y-0.5 hover:border-slate-300"
                >
                  <p className="text-lg font-semibold tracking-tight text-ink">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{item.description}</p>
                </Link>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
