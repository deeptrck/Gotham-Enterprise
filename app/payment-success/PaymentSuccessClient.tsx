"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import { verifyPaystackTransaction } from "@/lib/api";
import * as Sentry from "@sentry/nextjs";

export default function PaymentSuccessClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = searchParams.get("reference");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [userCredits, setUserCredits] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      setErrorMessage("No payment reference found");
      return;
    }

    const verifyPayment = async () => {
      try {
        setStatus("loading");
        const result = await verifyPaystackTransaction(reference);

        if (result.success) {
          setUserCredits(result.credits || 0);
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(result.message || "Payment verification failed");
        }
      } catch (err: unknown) {
        setStatus("error");
        Sentry.captureException(err);
        const message = err instanceof Error ? err.message : String(err);
        setErrorMessage(message || "Error verifying payment");
      }
    };

    verifyPayment();
  }, [reference]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {status === "loading" && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center">
            <Loader className="w-16 h-16 text-blue-600 dark:text-blue-400 mx-auto animate-spin mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Processing Payment</h1>
            <p className="text-slate-600 dark:text-slate-400">Please wait while we verify your payment...</p>
          </div>
        )}

        {status === "success" && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Payment Successful!</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Your credits have been added to your account.</p>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-6 mb-6">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">Current Credit Balance</p>
              <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{userCredits}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">credits available</p>
            </div>

            <div className="space-y-3">
              <button onClick={() => router.push("/dashboard")} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors">Go to Dashboard</button>
              <button onClick={() => router.push("/pricing-billing")} className="w-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold py-3 rounded-lg transition-colors">Buy More Credits</button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center">
            <XCircle className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Payment Verification Failed</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">{errorMessage}</p>

            <div className="space-y-3">
              <button onClick={() => router.push("/pricing-billing")} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors">Try Again</button>
              <button onClick={() => router.push("/dashboard")} className="w-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold py-3 rounded-lg transition-colors">Back to Dashboard</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
