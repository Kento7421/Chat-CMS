"use client";

import { useActionState } from "react";
import type { LoginActionState } from "@/lib/auth/actions";

type LoginFormProps = {
  title: string;
  description: string;
  submitLabel: string;
  action: (
    state: LoginActionState,
    formData: FormData
  ) => Promise<LoginActionState>;
};

const initialState: LoginActionState = {
  error: null
};

export function LoginForm({
  title,
  description,
  submitLabel,
  action
}: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="text-sm leading-7 text-slate-700">{description}</p>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
        メールアドレス
        <input
          type="email"
          name="email"
          required
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
        パスワード
        <input
          type="password"
          name="password"
          required
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-sea px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "ログイン中..." : submitLabel}
      </button>

      {state.error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
