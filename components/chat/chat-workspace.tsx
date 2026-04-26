"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { SiteCanvas } from "@/components/chat/site-canvas";
import { SitePreview } from "@/components/chat/site-preview";
import type { ChatAssetOption, ChatWorkspaceState } from "@/lib/chat";
import type { SiteSnapshot } from "@/types/domain";

type ChatWorkspaceProps = {
  siteId: string;
  siteSlug: string;
  siteName: string;
  initialSnapshot: SiteSnapshot;
  initialWorkspace: ChatWorkspaceState;
  initialAssets: ChatAssetOption[];
};

type ApiPayload = {
  error?: string;
};

export function ChatWorkspace({
  siteId,
  siteSlug,
  siteName,
  initialSnapshot,
  initialWorkspace,
  initialAssets
}: ChatWorkspaceProps) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [currentSnapshot, setCurrentSnapshot] = useState(initialSnapshot);
  const [assets, setAssets] = useState(initialAssets);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isSending, startSendTransition] = useTransition();
  const [isSelecting, startSelectTransition] = useTransition();
  const [isConfirming, startConfirmTransition] = useTransition();
  const [isUploading, startUploadTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null;
  const proposedSnapshot = workspace.pendingChangeSet?.proposedSnapshotJson ?? null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!message.trim()) {
      return;
    }

    startSendTransition(async () => {
      try {
        setNotice(null);
        setWarning(null);

        const response = await fetch("/api/chat/interpret", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            siteId,
            sessionId: workspace.session?.id,
            assetId: selectedAssetId || undefined,
            message
          })
        });
        const payload = (await response.json()) as ApiPayload & {
          warning?: string | null;
          workspace: ChatWorkspaceState;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "チャット解釈に失敗しました。");
        }

        setWorkspace(payload.workspace);
        setMessage("");
        setWarning(payload.warning ?? null);
        setSelectedAssetId("");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "チャット解釈に失敗しました。");
      }
    });
  }

  function handleSelectSuggestion(suggestionSetId: string, suggestionKey: string) {
    startSelectTransition(async () => {
      try {
        setNotice(null);

        const response = await fetch("/api/chat/select-suggestion", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            suggestionSetId,
            suggestionKey
          })
        });
        const payload = (await response.json()) as ApiPayload & {
          confirmationMessage?: string;
          workspace: ChatWorkspaceState;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "候補の選択に失敗しました。");
        }

        setWorkspace(payload.workspace);
        setNotice(payload.confirmationMessage ?? "確認用プレビューを更新しました。");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "候補の選択に失敗しました。");
      }
    });
  }

  function handleConfirm(changeSetId: string) {
    startConfirmTransition(async () => {
      try {
        setNotice(null);
        const nextPublishedSnapshot =
          workspace.pendingChangeSet?.proposedSnapshotJson ?? currentSnapshot;

        const response = await fetch("/api/chat/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            changeSetId
          })
        });
        const payload = (await response.json()) as ApiPayload & {
          message?: string;
          workspace: ChatWorkspaceState;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "公開に失敗しました。");
        }

        setCurrentSnapshot(nextPublishedSnapshot);
        setWorkspace(payload.workspace);
        setNotice(payload.message ?? "公開が完了しました。");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "公開に失敗しました。");
      }
    });
  }

  function handleUploadAsset() {
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setNotice("アップロードする画像を選択してください。");
      return;
    }

    startUploadTransition(async () => {
      try {
        setNotice(null);

        const formData = new FormData();
        formData.append("siteId", siteId);
        formData.append("file", file);
        formData.append("altText", file.name.replace(/\.[^.]+$/, ""));

        const response = await fetch("/api/assets", {
          method: "POST",
          body: formData
        });
        const payload = (await response.json()) as ApiPayload & {
          asset?: {
            id: string;
            original_filename: string;
            alt_text: string | null;
            mime_type: string;
            width: number | null;
            height: number | null;
          };
          publicUrl?: string;
        };

        if (!response.ok || !payload.asset) {
          throw new Error(payload.error ?? "画像アップロードに失敗しました。");
        }

        const nextAsset: ChatAssetOption = {
          id: payload.asset.id,
          originalFilename: payload.asset.original_filename,
          altText: payload.asset.alt_text,
          mimeType: payload.asset.mime_type,
          width: payload.asset.width,
          height: payload.asset.height,
          publicUrl: payload.publicUrl ?? null
        };

        setAssets((current) => [nextAsset, ...current.filter((asset) => asset.id !== nextAsset.id)]);
        setSelectedAssetId(nextAsset.id);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        setNotice("画像を保存しました。このままチャットで差し替え指示を出せます。");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "画像アップロードに失敗しました。");
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
      <div className="xl:sticky xl:top-24 xl:self-start">
        <SiteCanvas
          siteSlug={siteSlug}
          currentSnapshot={currentSnapshot}
          proposedSnapshot={proposedSnapshot}
        />
      </div>

      <section className="rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur sm:p-6">
        <div className="space-y-2 border-b border-slate-200/80 pb-4">
          <h2 className="text-xl font-semibold text-ink">{siteName} への変更依頼</h2>
          <p className="text-sm leading-7 text-slate-700">
            右側のチャットで変更を伝えてください。候補が出たら選び、左側で見え方を確認してから反映できます。
          </p>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-800">
              使う画像を選ぶ
              <select
                value={selectedAssetId}
                onChange={(event) => setSelectedAssetId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800"
              >
                <option value="">画像を選ばない</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.originalFilename}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-4">
              <p className="text-sm font-medium text-slate-800">新しい画像をアップロード</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input ref={fileInputRef} type="file" accept="image/*" className="text-sm text-slate-700" />
                <button
                  type="button"
                  onClick={handleUploadAsset}
                  disabled={isUploading}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploading ? "Uploading..." : "Upload image"}
                </button>
              </div>
            </div>

            {selectedAsset ? (
              <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
                {selectedAsset.publicUrl ? (
                  <Image
                    src={selectedAsset.publicUrl}
                    alt={selectedAsset.altText ?? selectedAsset.originalFilename}
                    width={1200}
                    height={720}
                    className="h-40 w-full object-cover"
                    unoptimized
                  />
                ) : null}
                <div className="space-y-1 px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{selectedAsset.originalFilename}</p>
                  <p className="text-xs text-slate-600">
                    {selectedAsset.altText ?? "alt text はまだ設定されていません"}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {workspace.pendingNewsDraft ? (
          <section className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50/80 p-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-ink">お知らせの入力状況</h3>
              <p className="text-sm leading-6 text-slate-700">
                会話の途中でも、いま何が入っていて何が足りないかを確認できます。
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {buildPendingNewsDraftItems(workspace.pendingNewsDraft).map((item) => (
                <article
                  key={item.key}
                  className="rounded-[20px] border border-white/70 bg-white/90 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{item.label}</p>
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        item.isComplete
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      ].join(" ")}
                    >
                      {item.isComplete ? "入力済み" : "未入力"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-700">{item.summary}</p>

                  {item.imageUrl ? (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                      <Image
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        width={1200}
                        height={720}
                        className="h-24 w-full object-cover"
                        unoptimized
                      />
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700">
              {workspace.pendingNewsDraft.missingFields.length > 0 ? (
                <p>不足している項目: {formatMissingFieldLabels(workspace.pendingNewsDraft.missingFields)}</p>
              ) : (
                <p>必要な情報はそろっています。候補が出たら内容を確認してください。</p>
              )}
            </div>
          </section>
        ) : null}

        <div className="mt-5 space-y-4">
          {workspace.messages.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm leading-7 text-slate-600">
              例: 「トップの見出しを、精密加工の強みが伝わる言い方に変えたい」や
              「お知らせを1件追加したい」のように入力してください。
            </div>
          ) : (
            workspace.messages.map((item) => (
              <article
                key={item.id}
                className={[
                  "max-w-[92%] rounded-[24px] px-4 py-3 text-sm leading-7 shadow-sm",
                  item.role === "user"
                    ? "ml-auto bg-sea text-white"
                    : "bg-slate-100 text-slate-800"
                ].join(" ")}
              >
                {item.content}
              </article>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
            変更したい内容
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              placeholder="例: トップページの見出しを、製造業向けの精密加工パートナーらしい表現に変えたい"
              className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-800"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSending}
              className="rounded-full bg-sea px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? "Interpreting..." : "候補を出す"}
            </button>
            {warning ? <p className="text-xs leading-6 text-amber-700">{warning}</p> : null}
          </div>
        </form>

        <div className="mt-6 space-y-6">
          <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-ink">候補を選ぶ</h3>
              <p className="text-sm leading-7 text-slate-700">
                AI が提案した候補から近いものを選ぶと、左側に反映後イメージが出ます。
              </p>
            </div>
            <div className="mt-4 space-y-3">
              {workspace.activeSuggestionSet?.suggestions.length ? (
                workspace.activeSuggestionSet.suggestions.map((suggestion) => {
                  const isSelected =
                    workspace.activeSuggestionSet?.selectedSuggestionKey === suggestion.key;

                  return (
                    <article
                      key={suggestion.key}
                      className="rounded-[22px] border border-slate-200 bg-white p-4"
                    >
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold text-ink">{suggestion.title}</h4>
                        <p className="text-xs uppercase tracking-[0.18em] text-sea">
                          {suggestion.summary}
                        </p>
                        {suggestion.proposedAsset?.url ? (
                          <Image
                            src={suggestion.proposedAsset.url}
                            alt={suggestion.proposedAsset.altText ?? suggestion.proposedAsset.label}
                            width={1200}
                            height={720}
                            className="h-32 w-full rounded-2xl object-cover"
                            unoptimized
                          />
                        ) : null}
                        <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm leading-7 text-slate-800">
                          {suggestion.proposedValue}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={
                          isSelecting ||
                          Boolean(workspace.pendingChangeSet) ||
                          workspace.activeSuggestionSet?.status === "selected"
                        }
                        onClick={() =>
                          handleSelectSuggestion(workspace.activeSuggestionSet!.id, suggestion.key)
                        }
                        className="mt-4 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSelected ? "選択済み" : "この候補を使う"}
                      </button>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-5 text-sm leading-7 text-slate-600">
                  まだ候補はありません。上の入力欄に変更したい内容を入れてください。
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-ink">反映前の確認</h3>
              <p className="text-sm leading-7 text-slate-700">
                候補を選ぶと、変更点の一覧と承認前プレビューが出ます。
              </p>
            </div>
            {workspace.pendingChangeSet ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-ink">
                    {workspace.pendingChangeSet.summary ?? "変更内容を確認してください"}
                  </p>
                  <div className="mt-3 space-y-3">
                    {workspace.pendingChangeSet.previewDiff.map((item) => (
                      <article key={item.id} className="rounded-2xl bg-slate-50 px-3 py-3 text-sm">
                        <p className="font-medium text-slate-900">{item.summary}</p>
                        <p className="mt-1 text-xs leading-6 text-slate-500">
                          Before: {stringifyValue(item.beforeValue)}
                        </p>
                        <p className="text-xs leading-6 text-slate-500">
                          After: {stringifyValue(item.afterValue)}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>

                <SitePreview preview={workspace.pendingChangeSet.preview} />

                <button
                  type="button"
                  disabled={isConfirming}
                  onClick={() => handleConfirm(workspace.pendingChangeSet!.id)}
                  className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isConfirming ? "Publishing..." : "この内容で反映する"}
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-5 text-sm leading-7 text-slate-600">
                候補を選ぶと、ここに反映前の確認が表示されます。
              </div>
            )}
          </section>

          {notice ? (
            <div className="rounded-[24px] border border-sea/20 bg-sea/10 px-4 py-3 text-sm leading-7 text-sea">
              {notice}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function stringifyValue(value: unknown) {
  if (value == null) {
    return "none";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function formatMissingFieldLabels(missingFields: Array<"title" | "body" | "image">) {
  return missingFields.map(getPendingFieldLabel).join(" / ");
}

function getPendingFieldLabel(field: "title" | "body" | "image") {
  switch (field) {
    case "title":
      return "タイトル";
    case "body":
      return "本文";
    case "image":
      return "画像";
    default:
      return field;
  }
}

function summarizeTextValue(value: string | null, emptyLabel: string) {
  if (!value) {
    return emptyLabel;
  }

  return value.length > 90 ? `${value.slice(0, 90)}...` : value;
}

function buildPendingNewsDraftItems(pendingNewsDraft: NonNullable<ChatWorkspaceState["pendingNewsDraft"]>) {
  return [
    {
      key: "title",
      label: "タイトル",
      isComplete: Boolean(pendingNewsDraft.title),
      summary: summarizeTextValue(pendingNewsDraft.title, "まだ入力されていません"),
      imageUrl: null,
      imageAlt: ""
    },
    {
      key: "body",
      label: "本文",
      isComplete: Boolean(pendingNewsDraft.body),
      summary: summarizeTextValue(pendingNewsDraft.body, "まだ入力されていません"),
      imageUrl: null,
      imageAlt: ""
    },
    {
      key: "image",
      label: "画像",
      isComplete: !pendingNewsDraft.missingFields.includes("image"),
      summary: pendingNewsDraft.imageAssetId
        ? pendingNewsDraft.imageAltText ?? "画像が選択されています"
        : pendingNewsDraft.imageRequested
          ? "画像が必要ですが、まだ選ばれていません"
          : "今回は画像なしで進められます",
      imageUrl: pendingNewsDraft.imageUrl,
      imageAlt: pendingNewsDraft.imageAltText ?? "選択中の画像"
    }
  ];
}
