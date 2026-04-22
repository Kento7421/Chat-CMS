import { customerLoginAction } from "@/lib/auth/actions";
import { redirectAuthenticatedUser } from "@/lib/auth/server";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  await redirectAuthenticatedUser();

  return (
    <div className="mx-auto w-full max-w-xl">
      <section className="rounded-[32px] border border-white/60 bg-white/80 p-8 shadow-panel backdrop-blur">
        <LoginForm
          title="顧客ログイン"
          description="顧客向けの管理画面に入るためのログインです。ログイン後は自社の site だけ操作できます。"
          submitLabel="顧客としてログイン"
          action={customerLoginAction}
        />
      </section>
    </div>
  );
}
