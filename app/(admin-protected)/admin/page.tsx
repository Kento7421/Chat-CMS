import { SectionCard } from "@/components/layout/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAdminUser } from "@/lib/auth/server";

export default async function AdminPage() {
  const appUser = await requireAdminUser();

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[28px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur sm:p-8">
        <StatusBadge>Operator Area</StatusBadge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            運営管理画面
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
            顧客管理、契約管理、サイト情報、監査ログを確認するためのエリアです。
            現在のログインユーザーは {appUser.email} です。
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard
          title="顧客管理"
          description="clients / users / sites の運営用ビューを配置する想定です。"
        />
        <SectionCard
          title="契約管理"
          description="プラン、契約状態、ドメイン情報などを確認する枠です。"
        />
        <SectionCard
          title="操作ログ"
          description="監査ログやロールバック操作の確認に使う想定です。"
        />
        <SectionCard
          title="保守対応"
          description="問題のある公開処理や障害対応用の情報を集約できます。"
        />
      </section>
    </div>
  );
}
