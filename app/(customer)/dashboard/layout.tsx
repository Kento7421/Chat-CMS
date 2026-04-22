import { requireCustomerUser } from "@/lib/auth/server";

export default async function DashboardLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireCustomerUser();

  return children;
}
