import Link from "next/link";
import { getCurrentAppUser } from "@/lib/auth/server";
import { SignOutForm } from "@/components/auth/sign-out-form";

const links = [
  { href: "/", label: "Scaffold" },
  { href: "/dashboard", label: "Customer" },
  { href: "/admin", label: "Admin" },
  { href: "/sites/demo-company", label: "Public" }
];

export async function AppNav() {
  const appUser = await getCurrentAppUser();

  return (
    <header className="sticky top-0 z-20 border-b border-white/60 bg-sand/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm font-semibold uppercase tracking-[0.3em] text-ink">
          Chat CMS
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 transition hover:bg-white/70 hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
          {appUser ? (
            <SignOutForm />
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 transition hover:bg-white/70 hover:text-ink"
              >
                Login
              </Link>
              <Link
                href="/admin/login"
                className="rounded-full px-4 py-2 transition hover:bg-white/70 hover:text-ink"
              >
                Admin Login
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
