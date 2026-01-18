"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSignUp, useSignIn } from "@clerk/nextjs";
import AnimatedText from "@/components/ui/animated-text";
import * as Sentry from "@sentry/nextjs";

export default function Signup() {
  const router = useRouter();
  const { isLoaded: signUpLoaded, signUp, setActive } = useSignUp();
  const { isLoaded: signInLoaded } = useSignIn();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");

  if (!signUpLoaded || !signInLoaded) return null;

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setErr(null);
  setLoading(true);

  try {
    if (!signUp) {
      setErr("SignUp object not ready. Please refresh and try again.");
      return;
    }

    // Split name into first + last
    const [firstName, ...rest] = name.trim().split(" ");
    const lastName = rest.join(" ") || "";

    await signUp.create({
      emailAddress: email,
      password,
      firstName,
      lastName,
    });

    await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    setPendingVerification(true);
  } catch (e: unknown) {
    console.error(e);
    Sentry.captureException(e);
    type ClerkErr = { errors?: Array<{ longMessage?: string; message?: string }>; message?: string };
    const errObj = e as ClerkErr;
    const message = errObj?.errors?.[0]?.longMessage || errObj?.errors?.[0]?.message || (e instanceof Error ? e.message : String(e)) || "Something went wrong";
    setErr(message);
  } finally {
    setLoading(false);
  }
}

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    if (!signUp) return;

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({ code });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        router.push("/login");
        return;
      }

      console.log("Sign-up not complete:", completeSignUp);
    } catch (e: unknown) {
      console.error(e);
      Sentry.captureException(e);
      type ClerkErr = { errors?: Array<{ longMessage?: string; message?: string }>; };
      const errObj = e as ClerkErr;
      const message = errObj?.errors?.[0]?.longMessage || errObj?.errors?.[0]?.message || "Invalid code";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  async function withGoogle() {
    setErr(null);
    if (!signUp) {
      setErr("SignUp object not ready. Please refresh and try again.");
      return;
    }

    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (e: unknown) {
      console.error(e);
      Sentry.captureException(e);
      type ClerkErr = { errors?: Array<{ longMessage?: string; message?: string }>; };
      const errObj = e as ClerkErr;
      const message = errObj?.errors?.[0]?.longMessage || errObj?.errors?.[0]?.message || "Google sign-up failed";
      setErr(message);
    }
  }

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto flex items-center justify-center text-foreground px-4">
      <div className="flex flex-col md:flex-row-reverse w-full max-w-5xl rounded-2xl overflow-hidden border border-border shadow-background backdrop-blur-md  bg-slate-50 dark:bg-card/30 ">
        {/* Left image */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-6">
          <Image
            src="/deeptrack-security.svg"
            alt="Signup Illustration"
            className="object-contain h-full w-full"
            width={400}
            height={400}
          />
          <AnimatedText />
        </div>

        {/* Right form area */}
        <div className="w-full md:w-1/2 px-6 py-10 sm:px-10 md:p-14 space-y-6">
          <h2 className="text-3xl font-bold dark:text-stone-100">
            Create Your Account
          </h2>

          {err && <p className="text-sm text-red-500">{err}</p>}

          {!pendingVerification ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm mb-1 text-foreground/80">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-input text-foreground border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="John Doe"
                />
              </div>

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

              <div>
                <label className="block text-sm mb-1 text-foreground/80">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-input text-foreground border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••"
                />
              </div>

              <div id="clerk-captcha"></div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-400 font-medium py-2 rounded-md shadow-sm hover:opacity-90 transition"
              >
                {loading ? "Creating account..." : "Sign Up"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <label className="block text-sm mb-1 text-foreground/80">Verification Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-input text-foreground border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter code from email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-300 font-medium py-2 rounded-md shadow-sm hover:opacity-90 transition"
              >
                {loading ? "Verifying..." : "Verify Email"}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Social Buttons */}
          <div className="flex flex-col gap-4">
            <button
              onClick={withGoogle}
              className="flex items-center justify-center gap-2 w-full dark:bg-white/5 dark:text-white py-2 rounded-md hover:bg-gray-100 hover:text-muted-foreground transition border border-border"
            >
              <Image src="/google-icon.svg" alt="Google" width={20} height={20} />
              Continue with Google
            </button>
          </div>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="dark:text-white text-sky-500 hover:underline">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
