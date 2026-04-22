import { signOutAction } from "@/lib/auth/actions";

export function SignOutForm() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400"
      >
        Sign Out
      </button>
    </form>
  );
}
