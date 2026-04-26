"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { AnalyticsSiteConfig } from "@/lib/analytics/schemas";

type SiteAnalyticsSettingsFormProps = {
  siteId: string;
  siteName: string;
  initialConfig: AnalyticsSiteConfig;
};

type ApiResponse = {
  error?: string;
  message?: string;
  siteConfig?: AnalyticsSiteConfig;
};

export function SiteAnalyticsSettingsForm({
  siteId,
  siteName,
  initialConfig
}: SiteAnalyticsSettingsFormProps) {
  const [provider, setProvider] = useState<AnalyticsSiteConfig["provider"]>(initialConfig.provider);
  const [ga4PropertyId, setGa4PropertyId] = useState(initialConfig.ga4PropertyId ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedConfig, setSavedConfig] = useState(initialConfig);
  const [isSaving, startSaveTransition] = useTransition();

  const needsProperty = provider === "ga4";
  const propertyMissing = needsProperty && ga4PropertyId.trim().length === 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startSaveTransition(async () => {
      try {
        setNotice(null);
        setErrorMessage(null);

        const response = await fetch("/api/settings/site-analytics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            siteId,
            provider,
            ga4PropertyId
          })
        });
        const payload = (await response.json()) as ApiResponse;

        if (!response.ok || !payload.siteConfig) {
          throw new Error(payload.error ?? "設定の保存に失敗しました。");
        }

        setSavedConfig(payload.siteConfig);
        setProvider(payload.siteConfig.provider);
        setGa4PropertyId(payload.siteConfig.ga4PropertyId ?? "");
        setNotice(payload.message ?? "設定を保存しました。");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "設定の保存に失敗しました。");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-800">対象サイト</p>
        <p className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
          {siteName}
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
        アクセス状況のデータ元
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value as AnalyticsSiteConfig["provider"])}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800"
        >
          <option value="fallback">簡易データを使う</option>
          <option value="ga4">GA4 を使う</option>
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
        GA4 プロパティ ID
        <input
          type="text"
          value={ga4PropertyId}
          onChange={(event) => setGa4PropertyId(event.target.value)}
          placeholder="例: 123456789"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 disabled:bg-slate-50"
          disabled={!needsProperty}
        />
      </label>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm leading-7 text-slate-700">
        {needsProperty ? (
          propertyMissing ? (
            <p>GA4 を使うには、プロパティ ID の入力が必要です。保存はできますが、接続確認では未設定として表示されます。</p>
          ) : (
            <p>保存後にアクセス状況画面へ戻ると、そのまま GA4 接続確認を行えます。</p>
          )
        ) : (
          <p>簡易データを使う場合は、GA4 プロパティ ID は不要です。</p>
        )}
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
          {notice}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "保存中..." : "設定を保存"}
        </button>
        <Link
          href={`/dashboard/analytics?siteId=${siteId}`}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900"
        >
          アクセス状況へ戻る
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 text-xs leading-6 text-slate-500">
        <p>現在の設定: {savedConfig.provider === "ga4" ? "GA4" : "簡易データ"}</p>
        <p>保存済みプロパティ ID: {savedConfig.ga4PropertyId ?? "未設定"}</p>
      </div>
    </form>
  );
}
