import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/components/ui/header";
import UserSyncProvider from "@/components/user-sync-provider";
// import { ThemeProvider } from "@/components/theme-provider";
// import Footer from "@/components/ui/footer";

const inter = { className: "font-sans" };

export const metadata: Metadata = {
  title: "Deeptrack Gotham",
  description: "Deepfake Verification made easy.",
  icons: {
    icon: "logo-light.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard">
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${inter.className} min-h-screen bg-background text-slate-900 dark:text-slate-100`}
        >
          {/* <ThemeProvider attribute="class" defaultTheme="light" enableSystem> */}
            <UserSyncProvider>
              <div className="flex flex-col min-h-screen">
                {/* Header */}
                <Header />

                {/* Main content */}
                <div className="flex flex-1 overflow-hidden">
                  <main className="flex-1 overflow-y-auto p-6">{children}</main>
                </div>

                {/* Footer */}
                {/* <Footer /> */}
              </div>
            </UserSyncProvider>
          {/* </ThemeProvider> */}
        </body>
      </html>
    </ClerkProvider>
  );
}
