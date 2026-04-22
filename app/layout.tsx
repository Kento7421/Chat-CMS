import type { Metadata } from "next";
import { AppNav } from "@/components/navigation/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chat CMS",
  description: "セルフ操作型チャットCMSのMVP土台"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <div className="min-h-screen">
          <AppNav />
          <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
