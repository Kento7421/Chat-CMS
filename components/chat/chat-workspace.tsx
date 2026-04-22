"use client";

import { useState, useTransition } from "react";
import type { ChatWorkspaceState } from "@/lib/chat";

type ChatWorkspaceProps = {
  siteId: string;
  initialWorkspace: ChatWorkspaceState;
};

type ApiPayload = {
  error?: string;
};

export function ChatWorkspace({ siteId, initialWorkspace }: ChatWorkspaceProps) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isSending, startSendTransition] = useTransition();
  const [isSelecting, startSelectTransition] = useTransition();
  const [isConfirming, startConfirmTransition] = useTransition();

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
            message
          })
        });
        const payload = ((await response.json()) as ApiPayload & {
          warning?: string | null;
          workspace: ChatWorkspaceState;
        });

        if (!response.ok) {
          throw new Error(payload.error ?? "候補生成に失敗しました。");
        }

        setWorkspace(payload.workspace);
        setMessage("");
        setWarning(payload.warning ?? null);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "候補生成に失敗しました。");
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
        const payload = ((await response.json()) as ApiPayload & {
          confirmationMessage?: string;
          workspace: ChatWorkspaceState;
        });

        if (!response.ok) {
          throw new Error(payload.error ?? "候補選択に失敗しました。");
        }

        setWorkspace(payload.workspace);
        setNotice(payload.confirmationMessage ?? "承認待ちの変更を作成しました。");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "候補選択に失敗しました。");
      }
    });
  }

  function handleConfirm(changeSetId: string) {
    startConfirmTransition(async () => {
      try {
        setNotice(null);

        const response = await fetch("/api/chat/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            changeSetId
          })
        });
        const payload = ((await response.json()) as ApiPayload & {
          message?: string;
          workspace: ChatWorkspaceState;
        });

        if (!response.ok) {
          throw new Error(payload.error ?? "公開処理に失敗しました。");
        }

        setWorkspace(payload.workspace);
        setNotice(payload.message ?? "変更を公開しました。");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "公開処理に失敗しました。");
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
      <section className="rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur sm:p-6">
        <div className="space-y-2 border-b border-slate-200/80 pb-4">
          <h2 className="text-xl font-semibold text-ink">会話履歴</h2>
          <p className="text-sm leading-7 text-slate-700">
            文言変更、電話番号、メールアドレス、営業時間の更新を自然文で依頼できます。
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {workspace.messages.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm leading-7 text-slate-600">
              例: 「トップページの見出しをもっと親しみやすくしたい」
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
            更新したい内容
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              placeholder="トップページの見出しをもっと親しみやすくしたい、など"
              className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-800"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSending}
              className="rounded-full bg-sea px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? "候補を作成中..." : "候補を作る"}
            </button>
            {warning ? <p className="text-xs leading-6 text-amber-700">{warning}</p> : null}
          </div>
        </form>
      </section>

      <aside className="space-y-6">
        <section className="rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur sm:p-6">
          <h2 className="text-xl font-semibold text-ink">候補</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            候補を選ぶと、すぐには公開せず承認待ちの変更を作成します。
          </p>
          <div className="mt-4 space-y-3">
            {workspace.activeSuggestionSet?.suggestions.length ? (
              workspace.activeSuggestionSet.suggestions.map((suggestion) => {
                const isSelected =
                  workspace.activeSuggestionSet?.selectedSuggestionKey === suggestion.key;

                return (
                  <article
                    key={suggestion.key}
                    className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-ink">{suggestion.title}</h3>
                      <p className="text-xs uppercase tracking-[0.18em] text-sea">
                        {suggestion.summary}
                      </p>
                      <p className="rounded-2xl bg-white px-3 py-2 text-sm leading-7 text-slate-800">
                        {suggestion.proposedValue}
                      </p>
                      <p className="text-xs leading-6 text-slate-600">{suggestion.reasoning}</p>
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
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm leading-7 text-slate-600">
                まだ候補はありません。左側から更新依頼を送ると、ここに候補カードが表示されます。
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur sm:p-6">
          <h2 className="text-xl font-semibold text-ink">承認待ち</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            承認ボタンを押したときだけ新しい site version を作成します。
          </p>
          {workspace.pendingChangeSet ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-ink">
                  {workspace.pendingChangeSet.summary ?? "変更内容を確認してください"}
                </p>
                <div className="mt-3 space-y-3">
                  {workspace.pendingChangeSet.previewDiff.map((item) => (
                    <article key={item.id} className="rounded-2xl bg-white px-3 py-3 text-sm">
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
              <button
                type="button"
                disabled={isConfirming}
                onClick={() => handleConfirm(workspace.pendingChangeSet!.id)}
                className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isConfirming ? "公開中..." : "承認して公開する"}
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm leading-7 text-slate-600">
              候補を選ぶと、ここに差分確認と承認ボタンが表示されます。
            </div>
          )}
        </section>

        {notice ? (
          <div className="rounded-[24px] border border-sea/20 bg-sea/10 px-4 py-3 text-sm leading-7 text-sea">
            {notice}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function stringifyValue(value: unknown) {
  if (value == null) {
    return "なし";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}
