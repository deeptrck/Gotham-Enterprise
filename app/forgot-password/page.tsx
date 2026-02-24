"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import AnimatedText from "@/components/ui/animated-text";
import * as Sentry from "@sentry/nextjs";

export default function ForgotPassword() {
  const router = useRouter();
  const { isLoaded, signIn } = useSignIn();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");

  if (!isLoaded) return null;

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (!signIn) {
        setErr("SignIn object not ready. Please refresh and try again.");
        return;
      }

      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });

      setSuccess("Verification code sent to your email!");
      setStep("code");
    } catch (e: unknown) {
      console.error(e);
      Sentry.captureException(e);
      type ClerkErr = { errors?: Array<{ longMessage?: string; message?: string }>; message?: string };
      const errObj = e as ClerkErr;
      const message = errObj?.errors?.[0]?.longMessage || errObj?.errors?.[0]?.message || (e instanceof Error ? e.message : String(e)) || "Failed to send code";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (!signIn) {
        setErr("SignIn object not ready. Please refresh and try again.");
        return;
      }

      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password: newPassword,
      });

      if (result.status === "complete") {
        setSuccess("Password reset successfully! Redirecting to login...");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
        return;
      }

      console.log("Password reset not complete:", result);
    } catch (e: unknown) {
      console.error(e);
      Sentry.captureException(e);
      type ClerkErr = { errors?: Array<{ longMessage?: string; message?: string }>; };
      const errObj = e as ClerkErr;
      const message = errObj?.errors?.[0]?.longMessage || errObj?.errors?.[0]?.message || "Invalid code or password";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto flex items-center justify-center text-foreground px-4">
      <div className="flex flex-col md:flex-row-reverse w-full max-w-5xl rounded-2xl overflow-hidden border border-border shadow-background backdrop-blur-md bg-slate-50 dark:bg-card/30">
        {/* Left image */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-6">
          <Image
            src="/deeptrack-security.svg"
            alt="Forgot Password Illustration"
            className="object-contain h-full w-full"
            width={400}
            height={400}
          />
          <AnimatedText />
        </div>

        {/* Right form area */}
        <div className="w-full md:w-1/2 px-6 py-10 sm:px-10 md:p-14 space-y-6">
          <h2 className="text-3xl font-bold dark:text-stone-100">
            Reset Your Password
          </h2>
          <p className="text-sm text-muted-foreground">
            {step === "email"
              ? "Enter your email address and we'll send you a verification code."
              : "Enter the verification code sent to your email and choose a new password."}
          </p>

          {err && <p className="text-sm text-red-500">{err}</p>}
          {success && <p className="text-sm text-green-500">{success}</p>}

          {step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-5">
              <div>
                <label className="block text-sm mb-1 text-foreground/80">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-input text-foreground border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-400 font-medium py-2 rounded-md shadow-sm hover:opacity-90 transition"
              >
                {loading ? "Sending Code..." : "Send Verification Code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-sm mb-1 text-foreground/80">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-input text-foreground border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter code from email"
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-foreground/80">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2 bg-input text-foreground border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-400 font-medium py-2 rounded-md shadow-sm hover:opacity-90 transition"
              >
                {loading ? "Resetting Password..." : "Reset Password"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setNewPassword("");
                  setErr(null);
                  setSuccess(null);
                }}
                className="w-full text-sm text-sky-500 hover:underline"
              >
                Back to email entry
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link href="/login" className="text-sky-500 dark:text-white hover:underline">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
