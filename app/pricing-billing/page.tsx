"use client";

import { useState } from "react";
import { Check, Zap } from "lucide-react";
import { createPaystackTransaction, subscribeToTrial } from "@/lib/api";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function PricingBillingPage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [loadingRef, setLoadingRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const showToast = (message: string, ms = 4000) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => {
      setToastVisible(false);
      setToastMessage(null);
    }, ms);
  };

  // Test credit packages with USD amounts for Paystack (client uses USD only)
  const creditPacks = [
    { id: "small", usdAmount: 5, credits: 50, label: "50 Credits", savings: null },
    { id: "medium", usdAmount: 20, credits: 300, label: "300 Credits", savings: "17% off" },
    { id: "large", usdAmount: 40, credits: 650, label: "650 Credits", savings: "25% off" },
  ];

  const plans = [
    {
      id: "trial",
      name: "Trial",
      price: "Free",
      description: "Get started",
      credits: 5,
      features: [
        "5 scan credits",
        "Basic results",
        "30-day access",
        "Email support",
      ],
      highlighted: false,
    },
    {
      id: "starter",
      name: "Starter",
      priceMonthly: "$2",
      usdAmountMonthly: 2,
      priceYearly: "$950",
      usdAmountYearly: 950,
      savingsYearly: "Save $238",
      description: "For individuals",
      credits: 100,
      features: [
        "100 scan credits/month",
        "Advanced analytics",
        "API access",
        "Priority support",
        "Custom branding",
      ],
      highlighted: false,
    },
    {
      id: "growth",
      name: "Growth",
      priceMonthly: "$499",
      usdAmountMonthly: 499,
      priceYearly: "$4,790",
      usdAmountYearly: 4790,
      savingsYearly: "Save $1,198",
      description: "Most popular",
      credits: 1000,
      features: [
        "1,000 scan credits/month",
        "Real-time dashboards",
        "Webhook integrations",
        "Team collaboration (5 users)",
        "24/7 phone support",
        "Advanced reporting",
      ],
      highlighted: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "Custom",
      description: "For large teams",
      credits: 10000,
      features: [
        "10,000+ scan credits/month",
        "Dedicated account manager",
        "SLA guarantees",
        "Multi-team management",
        "Compliance & audit logs",
        "Custom integrations",
      ],
      highlighted: false,
    },
  ];


  const handleBuyCredits = async (pack: typeof creditPacks[0]) => {
    if (!isSignedIn) {
      setShowAuthModal(true);
      showToast('Please sign in to continue');
      return;
    }

    try {
      setLoadingRef(pack.id + "-USD");
      const amount = pack.usdAmount;
      const res = await createPaystackTransaction(amount, pack.credits, "USD");
      const authorizationUrl = res?.data?.authorization_url;
      if (authorizationUrl) {
        window.location.href = authorizationUrl;
      } else {
        console.error("No authorization URL returned", res);
        showToast("Failed to initialize payment. Check console.");
      }
    } catch (err) {
      console.error(err);
      showToast("Error initializing payment. See console for details.");
    } finally {
      setLoadingRef(null);
    }
  };

  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  type Plan = typeof plans[number];
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const openPlanCurrencyModal = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowCurrencyModal(true);
  };

  const choosePlanCurrency = async () => {
    if (!selectedPlan) return;
    if (!isSignedIn) {
      setShowAuthModal(true);
      showToast('Please sign in to continue');
      return;
    }

    try {
      setShowCurrencyModal(false);
      setLoadingRef(selectedPlan.id + "-plan-USD");
      const amount = billingPeriod === 'monthly' ? selectedPlan.usdAmountMonthly : selectedPlan.usdAmountYearly;
      if (amount == null) {
        setError("Invalid pricing configuration. Please contact support.");
        return;
      }
      const res = await createPaystackTransaction(amount, selectedPlan.credits, "USD");
      const authorizationUrl = res?.data?.authorization_url;
      if (authorizationUrl) {
        window.location.href = authorizationUrl;
      } else {
        console.error("No authorization URL returned for plan purchase", res);
        showToast("Failed to initialize payment. Check console.");
      }
    } catch (err) {
      console.error(err);
      showToast("Error initializing plan purchase. See console.");
    } finally {
      setLoadingRef(null);
    }
  };

  const handleSubscribeTrial = async (plan: Plan) => {
    if (!isSignedIn) {
      setShowAuthModal(true);
      showToast('Please sign in to continue');
      return;
    }

    try {
      setLoadingRef(plan.id + "-trial");
      const res = await subscribeToTrial();
      if (res && res.success) {
        showToast(`Trial activated — ${res.credits} credits added to your account`);
        // update local credit display without leaving the page
        setUserCredits(res.credits ?? null);
      } else {
        showToast('Unable to activate trial. Please contact support.');
      }
    } catch (err) {
      console.error('Error subscribing to trial', err);
      showToast('Error activating trial. See console for details.');
    } finally {
      setLoadingRef(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-white">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center mb-16">
          {userCredits !== null && (
            <div className="mb-6 inline-block bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-200 px-4 py-2 rounded">
              🎉 You have <strong className="font-semibold">{userCredits}</strong> credits available
            </div>
          )}
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-2 sm:mb-0">
              Choose the perfect plan for your verification needs
            </p>
            
          </div>


        </div>

        {/* Currency modal for plan purchase (USD confirmation) */}
        {showCurrencyModal && selectedPlan && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold mb-4">Confirm purchase</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                You&apos;re about to purchase the <strong>{selectedPlan.name}</strong> plan for{" "}
                <strong>
                  $
                  {billingPeriod === 'monthly'
                    ? selectedPlan.usdAmountMonthly
                    : selectedPlan.usdAmountYearly}
                </strong>
                /{billingPeriod === 'monthly' ? 'month' : 'year'}. Click below to pay in USD.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => choosePlanCurrency()}
                  className="flex-1 bg-blue-500 text-white hover:bg-blue-600 py-2 rounded-lg font-semibold"
                >
                  Pay $
                  {billingPeriod === 'monthly'
                    ? selectedPlan.usdAmountMonthly
                    : selectedPlan.usdAmountYearly}
                </button>
              </div>
              <div className="mt-4 text-right">
                <button
                  onClick={() => setShowCurrencyModal(false)}
                  className="text-sm text-slate-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Auth required modal */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold mb-4">Please sign in</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">You must be signed in to complete this action. Sign in or create an account to continue.</p>
              <div className="flex gap-3">
                <button onClick={() => router.push('/login')} className="flex-1 bg-blue-500 text-white hover:bg-blue-600 py-2 rounded-lg font-semibold">Sign in</button>
                <button onClick={() => setShowAuthModal(false)} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white py-2 rounded-lg font-semibold">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toastVisible && toastMessage && (
          <div className="fixed top-6 right-6 z-60">
            <div className="max-w-xs bg-slate-900 text-white px-4 py-3 rounded shadow-lg">
              {toastMessage}
            </div>
          </div>
        )}

        {/* Billing Period Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              billingPeriod === 'monthly'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              billingPeriod === 'yearly'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
            }`}
          >
            Yearly
          </button>
        </div>
        {billingPeriod === 'yearly' && (
          <div className="text-center mb-8">
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">Pay yearly, save 20%</p>
          </div>
        )}

        {/* Pricing Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-xl transition-all duration-300 ${
                plan.highlighted
                  ? "lg:scale-105 bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-2xl"
                  : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md hover:shadow-lg border border-slate-200 dark:border-slate-700"
              }`}
            >
              {/* Popular Badge */}
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-red-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="p-8">
                {/* Plan name and description */}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className={plan.highlighted ? "text-blue-100" : "text-slate-600 dark:text-slate-400"}>
                  {plan.description}
                </p>

                {/* Price */}
                <div className="my-6">
                  <span className="text-4xl font-bold">
                    {plan.id === 'trial' || plan.id === 'enterprise'
                      ? plan.price
                      : billingPeriod === 'monthly'
                      ? plan.priceMonthly
                      : plan.priceYearly}
                  </span>
                  {plan.id !== "trial" && plan.id !== "enterprise" && (
                    <span className={plan.highlighted ? "text-blue-100" : "text-slate-600 dark:text-slate-400"}>
                      {" "}/{billingPeriod === 'monthly' ? 'month' : 'year'}
                    </span>
                  )}
                  {plan.id !== "trial" && plan.id !== "enterprise" && billingPeriod === 'yearly' && plan.savingsYearly && (
                    <div className={`text-sm mt-2 ${plan.highlighted ? 'text-blue-100' : 'text-green-600 dark:text-green-400'}`}>
                      {plan.savingsYearly}
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                  {plan.id !== 'trial' && plan.id !== 'enterprise' && (
                    <div className="text-2xl font-bold">
                      $
                      {billingPeriod === 'monthly'
                        ? plan.usdAmountMonthly ?? 0
                        : plan.usdAmountYearly ?? 0}
                    </div>
                  )}
                  {plan.id === 'trial' ? (
                    <button
                      className="w-full sm:w-auto bg-white text-blue-500 border border-blue-100 py-2 px-4 rounded-lg font-semibold"
                      onClick={() => handleSubscribeTrial(plan)}
                    >
                      {loadingRef === plan.id + "-trial" ? 'Processing...' : 'Get Started'}
                    </button>
                  ) : plan.id === 'enterprise' ? (
                    <a href="mailto:sales@deeptrack.com" className="w-full sm:w-auto inline-flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white py-2 px-4 rounded-lg font-semibold">Contact Sales</a>
                  ) : (
                    <button
                      className="w-full sm:w-auto bg-blue-500 text-white py-2 px-4 rounded-lg font-semibold"
                      onClick={() => openPlanCurrencyModal(plan)}
                    >
                      Choose plan
                    </button>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span className={`text-sm ${plan.highlighted ? "text-blue-50" : ""}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ / Info Section */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg">
            <h4 className="text-lg font-semibold mb-2">No Credit Card Required</h4>
            <p className="text-slate-600 dark:text-slate-400">
              Start with our free trial. Upgrade anytime.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg">
            <h4 className="text-lg font-semibold mb-2">Flexible Billing</h4>
            <p className="text-slate-600 dark:text-slate-400">
              Pay as you go or subscribe to save more.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg">
            <h4 className="text-lg font-semibold mb-2">Cancel Anytime</h4>
            <p className="text-slate-600 dark:text-slate-400">
              No contracts or hidden fees. Cancel with one click.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}