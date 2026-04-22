"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginActionState = {
  error: string | null;
};

const initialLoginState: LoginActionState = {
  error: null
};

export function getInitialLoginState() {
  return initialLoginState;
}

async function loadAppUserByAuthUserId(authUserId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id,role,client_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function customerLoginAction(
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "ログイン情報の取得に失敗しました。" };
  }

  const appUser = await loadAppUserByAuthUserId(user.id);

  if (!appUser || appUser.role === "operator_admin" || !appUser.client_id) {
    await supabase.auth.signOut();
    return { error: "顧客アカウントでログインしてください。" };
  }

  redirect("/dashboard");
}

export async function adminLoginAction(
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "ログイン情報の取得に失敗しました。" };
  }

  const appUser = await loadAppUserByAuthUserId(user.id);

  if (!appUser || appUser.role !== "operator_admin") {
    await supabase.auth.signOut();
    return { error: "管理者アカウントでログインしてください。" };
  }

  redirect("/admin");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
