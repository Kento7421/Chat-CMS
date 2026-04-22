"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type RollbackButtonProps = {
  targetVersionId: string;
};

export function RollbackButton({ targetVersionId }: RollbackButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleRollback() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/rollback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            targetVersionId
          })
        });
        const payload = (await response.json()) as
          | { version?: { id: string }; message?: string; error?: string }
          | undefined;

        if (!response.ok) {
          throw new Error(payload?.error ?? "ロールバックに失敗しました。");
        }

        setMessage(payload?.message ?? "ロールバックが完了しました。");

        if (payload?.version?.id) {
          router.push(`/dashboard/history/${payload.version.id}`);
          router.refresh();
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "ロールバックに失敗しました。"
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleRollback}
        disabled={isPending}
        className="rounded-full bg-coral px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "ロールバック中..." : "この版に戻す"}
      </button>
      {message ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
