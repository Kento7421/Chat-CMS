import { notFound } from "next/navigation";
import { SectionCard } from "@/components/layout/section-card";
import { demoSnapshots } from "@/lib/mock-data";

type PublicSitePageProps = {
  params: {
    siteSlug: string;
  };
};

export default function PublicSitePage({ params }: PublicSitePageProps) {
  const snapshot = demoSnapshots.find((item) => item.slug === params.siteSlug);

  if (!snapshot) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-panel backdrop-blur sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-sea">
          Public Site Preview
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
          {snapshot.name}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
          現時点では `site_versions.snapshot_json` を公開面の正本にする設計だけを
          前提にしたプレースホルダです。次段階でテンプレートレンダラに置き換えます。
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="トップメッセージ"
          description={snapshot.hero.copy}
          footer={`営業時間: ${snapshot.contact.businessHours}`}
        />
        <SectionCard
          title="問い合わせ先"
          description={`${snapshot.contact.phone} / ${snapshot.contact.email}`}
          footer={snapshot.templateName}
        />
      </section>
    </div>
  );
}
