import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser, AccessibleSite } from "@/lib/auth/types";

export class AuthenticationRequiredError extends Error {}

export class AuthorizationError extends Error {}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data: appUser, error: appUserError } = await admin
    .from("users")
    .select("id,auth_user_id,client_id,role,email,full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (appUserError) {
    throw new Error(appUserError.message);
  }

  if (!appUser?.auth_user_id) {
    return null;
  }

  return {
    id: appUser.id,
    authUserId: appUser.auth_user_id,
    clientId: appUser.client_id,
    role: appUser.role,
    email: appUser.email,
    fullName: appUser.full_name
  };
}

export async function requireCustomerUser() {
  const appUser = await getCurrentAppUser();

  if (!appUser) {
    redirect("/login");
  }

  if (appUser.role === "operator_admin") {
    redirect("/admin");
  }

  if (!appUser.clientId) {
    redirect("/login");
  }

  return appUser;
}

export async function requireAdminUser() {
  const appUser = await getCurrentAppUser();

  if (!appUser) {
    redirect("/admin/login");
  }

  if (appUser.role !== "operator_admin") {
    redirect("/dashboard");
  }

  return appUser;
}

export async function redirectAuthenticatedUser() {
  const appUser = await getCurrentAppUser();

  if (!appUser) {
    return;
  }

  if (appUser.role === "operator_admin") {
    redirect("/admin");
  }

  redirect("/dashboard");
}

export async function requireApiAppUser() {
  const appUser = await getCurrentAppUser();

  if (!appUser) {
    throw new AuthenticationRequiredError("ログインが必要です。");
  }

  return appUser;
}

export async function listAccessibleSitesForAppUser(appUser: AppUser): Promise<AccessibleSite[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("sites")
    .select("id,client_id,name,slug,current_version_id")
    .order("created_at", { ascending: true });

  if (appUser.role !== "operator_admin") {
    query = query.eq("client_id", appUser.clientId ?? "");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function assertAppUserCanAccessSite(appUser: AppUser, siteId: string) {
  const admin = createSupabaseAdminClient();
  const { data: site, error } = await admin
    .from("sites")
    .select("id,client_id,name,slug,current_version_id")
    .eq("id", siteId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!site) {
    throw new AuthorizationError("対象サイトが見つかりません。");
  }

  if (appUser.role !== "operator_admin" && site.client_id !== appUser.clientId) {
    throw new AuthorizationError("このサイトにアクセスする権限がありません。");
  }

  return site;
}
