"use client";

import { useState, useTransition } from "react";
import type { AnalyticsConnectionCheckResult } from "@/lib/analytics/schemas";

type Ga4ConnectionCheckProps = {
  siteId: string;
};

type ApiResponse = {
  error?: string;
  result?: AnalyticsConnectionCheckResult;
};

export function Ga4ConnectionCheck({ siteId }: Ga4ConnectionCheckProps) {
  const [result, setResult] = useState<AnalyticsConnectionCheckResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isChecking, startCheckTransition] = useTransition();

  function handleCheck() {
    startCheckTransition(async () => {
      try {
        setRequestError(null);

        const response = await fetch("/api/analytics/check-ga4", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ siteId })
        });
        const payload = (await response.json()) as ApiResponse;

        if (!response.ok || !payload.result) {
          throw new Error(payload.error ?? "GA4 接続確認に失敗しました。");
        }

        setResult(payload.result);
      } catch (error) {
        setResult(null);
        setRequestError(
          error instanceof Error ? error.message : "GA4 接続確認に失敗しました。"
        );
      }
    });
  }

  const appearance = getResultAppearance(result);

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/70 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold tracking-tight text-ink">GA4 接続確認</h3>
          <p className="text-sm leading-7 text-slate-700">
            このサイトの GA4 設定が使える状態かを確認します。簡易データ表示のままになっている理由もここで把握できます。
          </p>
        </div>
        <button
          type="button"
          onClick={handleCheck}
          disabled={isChecking}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isChecking ? "確認中..." : "GA4 接続を確認"}
        </button>
      </div>

      {requestError ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {requestError}
        </div>
      ) : null}

      {result ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-4 ${appearance.containerClass}`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${appearance.badgeClass}`}>
              {appearance.label}
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
              {formatResultCode(result.code)}
            </span>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-700">{result.message}</p>
          <div className="mt-3 space-y-1 text-xs leading-6 text-slate-500">
            <p>設定: {result.provider === "ga4" ? "GA4 を使用" : "簡易データを使用"}</p>
            <p>プロパティ ID: {result.propertyId ?? "未設定"}</p>
            <p>確認時刻: {formatDateTime(result.checkedAt)}</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-sm leading-7 text-slate-600">
          まだ確認していません。必要なときだけボタンを押して状態を確認できます。
        </div>
      )}
    </div>
  );
}

function formatResultCode(code: AnalyticsConnectionCheckResult["code"]) {
  switch (code) {
    case "ok":
      return "接続 OK";
    case "provider_not_ga4":
      return "GA4 未使用";
    case "property_missing":
      return "ID 未設定";
    case "env_missing":
      return "サーバー設定不足";
    case "token_failed":
      return "認証失敗";
    case "report_failed":
      return "データ取得失敗";
    default:
      return code;
  }
}

function getResultAppearance(result: AnalyticsConnectionCheckResult | null) {
  if (!result) {
    return {
      label: "未確認",
      containerClass: "border-slate-200 bg-white/70",
      badgeClass: "bg-slate-100 text-slate-700"
    };
  }

  if (result.ok) {
    return {
      label: "利用できます",
      containerClass: "border-emerald-200 bg-emerald-50/80",
      badgeClass: "bg-emerald-100 text-emerald-700"
    };
  }

  if (result.code === "provider_not_ga4" || result.code === "property_missing") {
    return {
      label: "設定を見直してください",
      containerClass: "border-amber-200 bg-amber-50/80",
      badgeClass: "bg-amber-100 text-amber-700"
    };
  }

  return {
    label: "接続できません",
    containerClass: "border-rose-200 bg-rose-50/80",
    badgeClass: "bg-rose-100 text-rose-700"
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
