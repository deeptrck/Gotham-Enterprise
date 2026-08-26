import Image from "next/image";
import Link from "next/link";
import AnimatedText from "@/components/ui/animated-text";

export default function ForgotPassword() {
  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto flex items-center justify-center text-foreground px-4">
      <div className="flex flex-col md:flex-row-reverse w-full max-w-5xl rounded-2xl overflow-hidden border border-border shadow-background backdrop-blur-md bg-slate-50 dark:bg-card/30">
        <div className="w-full md:w-1/2 flex items-center justify-center p-6">
          <Image
            src="/deeptrack-security.svg"
            alt="Secure password recovery"
            className="object-contain h-full w-full"
            width={400}
            height={400}
          />
          <AnimatedText />
        </div>

        <div className="w-full md:w-1/2 px-6 py-10 sm:px-10 md:p-14 space-y-6">
          <h2 className="text-3xl font-bold dark:text-stone-100">Reset your password</h2>
          <p className="text-sm text-muted-foreground">
            Auth0 will securely guide you through password recovery.
          </p>
          <a
            href="/auth/login?screen_hint=reset-password"
            className="block w-full text-center bg-sky-400 font-medium py-2 rounded-md shadow-sm hover:opacity-90 transition"
          >
            Reset password
          </a>
          <p className="text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link href="/login" className="text-sky-500 hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
