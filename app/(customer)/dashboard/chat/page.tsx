import Link from "next/link";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { SectionCard } from "@/components/layout/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireCustomerUser } from "@/lib/auth/server";
import { getChatWorkspaceForAppUser } from "@/lib/chat";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardChatPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const appUser = await requireCustomerUser();
  const resolvedSearchParams = await searchParams;
  const siteIdParam = resolvedSearchParams.siteId;
  const siteId = Array.isArray(siteIdParam) ? siteIdParam[0] : siteIdParam;
  const data = await getChatWorkspaceForAppUser(appUser, siteId);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[28px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur sm:p-8">
        <StatusBadge>Chat Update</StatusBadge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">チャット更新</h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
            自然文で更新依頼を出し、候補選択、承認、公開までをこの画面で進めます。
          </p>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        {data.accessibleSites.map((site) => {
          const isActive = site.id === data.selectedSiteId;

          return (
            <Link
              key={site.id}
              href={`/dashboard/chat?siteId=${site.id}`}
              className={[
                "rounded-full px-4 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-ink text-white"
                  : "border border-slate-300 bg-white/80 text-slate-800"
              ].join(" ")}
            >
              {site.name}
            </Link>
          );
        })}
      </section>

      {data.site && data.selectedSiteId ? (
        <ChatWorkspace siteId={data.selectedSiteId} initialWorkspace={data.workspace} />
      ) : (
        <SectionCard
          title="操作できるサイトがありません"
          description="チャット更新の対象サイトがまだ割り当てられていません。"
        />
      )}
    </div>
  );
}
