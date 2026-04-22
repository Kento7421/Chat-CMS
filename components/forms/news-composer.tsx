"use client";

import { useState, useTransition } from "react";
import type { AccessibleSite } from "@/lib/auth/types";
import { requestAiNewsFormatting } from "@/lib/news/ai-format";

type NewsComposerProps = {
  sites: AccessibleSite[];
  defaultSiteId?: string;
};

export function NewsComposer({ sites, defaultSiteId }: NewsComposerProps) {
  const initialSiteId = defaultSiteId ?? sites[0]?.id ?? "";
  const [siteId, setSiteId] = useState(initialSiteId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageAssetId, setImageAssetId] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isFormatting, startFormatting] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      try {
        const response = await fetch("/api/news", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            siteId,
            title,
            body,
            imageAssetId: imageAssetId || null,
            publish: true
          })
        });
        const payload = (await response.json()) as
          | {
              version?: { version_number: number };
              newsPost?: { title: string };
              error?: string;
            }
          | undefined;

        if (!response.ok) {
          throw new Error(payload?.error ?? "お知らせ公開に失敗しました。");
        }

        setResultMessage(
          `「${payload?.newsPost?.title ?? title}」を公開し、Version ${
            payload?.version?.version_number ?? "-"
          } を作成しました。`
        );
        setTitle("");
        setBody("");
        setImageAssetId("");
      } catch (error) {
        setResultMessage(
          error instanceof Error ? error.message : "お知らせ公開に失敗しました。"
        );
      }
    });
  }

  function handleAiFormatting() {
    startFormatting(async () => {
      const formatted = await requestAiNewsFormatting({ title, body });
      setTitle(formatted.title);
      setBody(formatted.body);
      setResultMessage(formatted.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
        対象サイト
        <select
          value={siteId}
          onChange={(event) => setSiteId(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
        >
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="画像 Asset ID（任意）"
        value={imageAssetId}
        onChange={setImageAssetId}
        placeholder="アップロード済み画像の Asset ID"
      />
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
        タイトル
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="ゴールデンウィーク休業のお知らせ"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
        本文
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={8}
          placeholder="5月3日から5月6日まで休業いたします。"
          className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isFormatting}
          onClick={handleAiFormatting}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isFormatting ? "整形準備中..." : "AI整形を試す（雛形）"}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-sea px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "公開中..." : "お知らせを公開"}
        </button>
      </div>
      {resultMessage ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {resultMessage}
        </p>
      ) : null}
    </form>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

function Field({ label, value, onChange, placeholder }: FieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
      />
    </label>
  );
}
