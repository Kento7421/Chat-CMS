"use client";

import { useState, useTransition } from "react";
import type { AccessibleSite } from "@/lib/auth/types";

type AssetUploaderProps = {
  sites: AccessibleSite[];
  defaultSiteId?: string;
};

export function AssetUploader({ sites, defaultSiteId }: AssetUploaderProps) {
  const initialSiteId = defaultSiteId ?? sites[0]?.id ?? "";
  const [siteId, setSiteId] = useState(initialSiteId);
  const [altText, setAltText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resultMessage, setResultMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setResultMessage("画像ファイルを選択してください。");
      return;
    }

    const dimensions = await readImageDimensions(selectedFile);
    const formData = new FormData();

    formData.set("siteId", siteId);
    formData.set("altText", altText);
    formData.set("file", selectedFile);

    if (dimensions.width) {
      formData.set("width", String(dimensions.width));
    }

    if (dimensions.height) {
      formData.set("height", String(dimensions.height));
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/assets", {
          method: "POST",
          body: formData
        });
        const payload = (await response.json()) as
          | { asset?: { original_filename: string }; error?: string }
          | undefined;

        if (!response.ok) {
          throw new Error(payload?.error ?? "画像アップロードに失敗しました。");
        }

        setResultMessage(`「${payload?.asset?.original_filename ?? "画像"}」を保存しました。`);
        setSelectedFile(null);
      } catch (error) {
        setResultMessage(
          error instanceof Error ? error.message : "画像アップロードに失敗しました。"
        );
      }
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
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
        画像ファイル
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] ?? null);
          }}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
        代替テキスト
        <input
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
          placeholder="トップページのメイン写真"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-sea px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "アップロード中..." : "画像をアップロード"}
      </button>
      {resultMessage ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {resultMessage}
        </p>
      ) : null}
    </form>
  );
}

async function readImageDimensions(file: File) {
  if (typeof window === "undefined") {
    return { width: null, height: null };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("画像サイズの取得に失敗しました。"));
      nextImage.src = objectUrl;
    });

    return {
      width: image.naturalWidth,
      height: image.naturalHeight
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
