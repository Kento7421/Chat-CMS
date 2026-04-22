import type { Database } from "@/types/database";

export type AppUserRole = Database["public"]["Tables"]["users"]["Row"]["role"];

export interface AppUser {
  id: string;
  authUserId: string;
  clientId: string | null;
  role: AppUserRole;
  email: string;
  fullName: string | null;
}

export interface AccessibleSite {
  id: string;
  client_id: string;
  name: string;
  slug: string;
  current_version_id: string | null;
}
