import { LoginForm } from "@/components/auth/login-form";
import { adminLoginAction } from "@/lib/auth/actions";
import { redirectAuthenticatedUser } from "@/lib/auth/server";

export default async function AdminLoginPage() {
  await redirectAuthenticatedUser();

  return (
    <div className="mx-auto w-full max-w-xl">
      <section className="rounded-[32px] border border-white/60 bg-white/80 p-8 shadow-panel backdrop-blur">
        <LoginForm
          title="管理者ログイン"
          description="運営向けの管理画面に入るためのログインです。顧客アカウントでは入れません。"
          submitLabel="管理者としてログイン"
          action={adminLoginAction}
        />
      </section>
    </div>
  );
}
