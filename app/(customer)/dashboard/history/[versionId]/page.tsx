import Link from "next/link";
import { notFound } from "next/navigation";
import { RollbackButton } from "@/components/history/rollback-button";
import { SectionCard } from "@/components/layout/section-card";
import { requireCustomerUser } from "@/lib/auth/server";
import { getSiteVersionDetailForAppUser } from "@/lib/versions/service";
import type { Json } from "@/types/database";

type DashboardVersionDetailPageProps = {
  params: Promise<{
    versionId: string;
  }>;
};

export default async function DashboardVersionDetailPage({
  params
}: DashboardVersionDetailPageProps) {
  const appUser = await requireCustomerUser();
  const routeParams = await params;
  const detail = await safeGetSiteVersionDetail(appUser, routeParams.versionId);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-ink">
              Version {detail.version.version_number}
            </h1>
            <p className="text-sm leading-7 text-slate-700">
              {detail.version.summary ?? "summary 未設定"}
            </p>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              {detail.version.created_at}
            </p>
          </div>
          {detail.version.isCurrent ? (
            <span className="inline-flex rounded-full bg-sea/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sea">
              Current
            </span>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
        <SectionCard
          title="版情報"
          description="parent / rollback 関係と、現在版への復元導線を確認できます。"
        >
          <div className="space-y-3 text-sm text-slate-700">
            <p>Site: {detail.site.name}</p>
            <p>Parent Version ID: {detail.version.parent_version_id ?? "-"}</p>
            <p>Rollback From Version ID: {detail.version.rollback_from_version_id ?? "-"}</p>
            <p>Source Change Set ID: {detail.version.source_change_set_id ?? "-"}</p>
            <Link
              href={`/dashboard/history?siteId=${detail.site.id}`}
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900"
            >
              一覧へ戻る
            </Link>
            {!detail.version.isCurrent ? (
              <RollbackButton targetVersionId={detail.version.id} />
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="差分詳細"
          description="変更前後の値を old / new で確認できます。"
        >
          <div className="space-y-4">
            {detail.changes.length ? (
              detail.changes.map((change) => (
                <article
                  key={change.id}
                  className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">
                      {change.summary ?? `${change.field_key ?? "field"} の変更`}
                    </p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {change.change_type}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <ValuePanel label="Old" value={change.before_value} />
                    <ValuePanel label="New" value={change.after_value} />
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                この版には保存済み差分がありません。
              </p>
            )}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

function ValuePanel({ label, value }: { label: string; value: Json | null }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs leading-6 text-slate-700">
        {value == null ? "-" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

async function safeGetSiteVersionDetail(
  appUser: Awaited<ReturnType<typeof requireCustomerUser>>,
  versionId: string
) {
  try {
    return await getSiteVersionDetailForAppUser(appUser, versionId);
  } catch {
    return null;
  }
}
