import type { Metadata } from "next";
import "./globals.css";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import Header from "@/components/ui/header";
import UserSyncProvider from "@/components/user-sync-provider";
import { auth0 } from "@/lib/auth0";

const inter = { className: "font-sans" };

export const metadata: Metadata = {
  title: "Deeptrack Gotham",
  description: "Deepfake Verification made easy.",
  icons: {
    icon: "logo-light.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth0.getSession();

  return (
    <Auth0Provider user={session?.user}>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${inter.className} min-h-screen bg-background text-slate-900 dark:text-slate-100`}
        >
          <UserSyncProvider>
            <div className="flex flex-col min-h-screen">
              <Header />
              <div className="flex flex-1 overflow-hidden">
                <main className="flex-1 overflow-y-auto p-6">{children}</main>
              </div>
            </div>
          </UserSyncProvider>
        </body>
      </html>
    </Auth0Provider>
  );
}
