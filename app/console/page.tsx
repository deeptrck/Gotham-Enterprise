"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const endpoint = process.env.NEXT_PUBLIC_GOTHAM_ENDPOINT || "https://gotham.deeptrack.io/scan";

const tabLabels = ["curl", "python", "javascript"] as const;

type TabType = (typeof tabLabels)[number];

export default function ApiConsolePage() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<{
    keys: Array<{ api_key_preview: string | null; scans_used: number; status: string | null }>; total_scans: number;
  }>({ keys: [], total_scans: 0 });
  const [activeTab, setActiveTab] = useState<TabType>("curl");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = user?.id || "";
  const clientName =
    user?.fullName ||
    (user?.primaryEmailAddress?.emailAddress as string | undefined) ||
    (user?.emailAddresses?.[0]?.emailAddress as string | undefined) ||
    "unknown";

  useEffect(() => {
    if (isSignedIn === false) {
      router.push("/login");
    }
  }, [isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn || !clientId) return;

    const fetchUsage = async () => {
      try {
        const response = await fetch(`/api/usage?clientId=${encodeURIComponent(clientId)}`);
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || "Failed to fetch usage data");
        }
        const data = await response.json();
        setUsage({ keys: data.keys ?? [], total_scans: Number(data.total_scans ?? 0) });
      } catch (err) {
        console.error("Error fetching usage data:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    fetchUsage();
  }, [isSignedIn, clientId]);

  const generateKey = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/generate-key", {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to generate API key");
      }
      const data = await res.json();
      setApiKey(data.api_key);
      setCopied(false);
      setTimeout(() => {
        if (data.api_key) setApiKey(data.api_key);
      }, 0);
      // Refresh usage stats after key generation
      if (clientId) {
        await fetch(`/api/usage?clientId=${encodeURIComponent(clientId)}`);
      }
    } catch (err) {
      console.error("Error generating key:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async () => {
    if (!apiKey) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/revoke-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to revoke API key");
      }
      setApiKey(null);
      await fetch(`/api/usage?clientId=${encodeURIComponent(clientId)}`);
    } catch (err) {
      console.error("Error revoking key:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const codeSnippets = useMemo(() => ({
    curl: `curl -X POST ${endpoint} \
  -H 'x-api-key: ${apiKey ?? "<YOUR_API_KEY>"}' \
  -H 'Content-Type: application/json' \
  -d '{"file_url": "https://example.com/video.mp4"}'`,
    python: `import requests

response = requests.post(
  "${endpoint}",
  headers={"x-api-key": "${apiKey ?? "<YOUR_API_KEY>"}"},
  json={"file_url": "https://example.com/video.mp4"}
)
print(response.json())`,
    javascript: `const response = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "x-api-key": "${apiKey ?? "<YOUR_API_KEY>"}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ file_url: "https://example.com/video.mp4" }),
});

const result = await response.json();
console.log(result);`,
  }), [apiKey]);

  const currentSnippet = codeSnippets[activeTab];

  return (
    <main className="min-h-screen bg-slate-50 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Gotham API Console</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">API key generation and usage</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Generate a Gotham API key, copy it once, and view live usage statistics for your client.
            </p>
          </div>
          <Button onClick={generateKey} disabled={loading}>
            {loading ? "Working..." : "Generate API Key"}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>API key</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Endpoint</p>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <code className="break-words rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-slate-950 dark:text-slate-100">{endpoint}</code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(endpoint);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? "Copied!" : "Copy endpoint"}
                    </Button>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/40 dark:text-red-200">
                    {error}
                  </div>
                ) : null}

                {apiKey ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">Your API key</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(apiKey);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                        >
                          {copied ? "Copied!" : "Copy key"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={revokeKey}>
                          Revoke key
                        </Button>
                      </div>
                    </div>
                    <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-xs text-slate-100 shadow-sm">
                      {apiKey}
                    </pre>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                      Save this key now. It will not be shown again.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    Click <strong>Generate API Key</strong> to create a real Gotham key and copy it once.
                  </div>
                )}

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center gap-2">
                    {tabLabels.map((tab) => (
                      <Button
                        key={tab}
                        size="sm"
                        variant={activeTab === tab ? "default" : "outline"}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
                    {currentSnippet}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage dashboard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-sm text-slate-500 dark:text-slate-400">Client</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{clientName}</p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total scans</p>
                  <p className="mt-1 text-3xl font-semibold text-slate-900 dark:text-white">{usage.total_scans}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-sm text-slate-500 dark:text-slate-400">API keys</p>
                  <p className="mt-1 text-3xl font-semibold text-slate-900 dark:text-white">{usage.keys.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Latest key status</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                    {usage.keys?.[0]?.status ?? "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
