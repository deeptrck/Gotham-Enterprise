"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { UploadCloud, Link2, Image as ImageIcon, Video, AudioWaveform, Shield, Globe, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createScan } from "@/lib/api";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import * as Sentry from "@sentry/nextjs";


type UploadProgress = {
  fileName: string;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

export default function EnterpriseUpload() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])

const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  if (!isSignedIn) {
    router.push("/login");
    return;
  }

  setLoading(true);
  setError(null);

  // Initialize progress for each file
  const progressArray: UploadProgress[] = Array.from(files).map(f => ({
    fileName: f.name,
    status: "uploading",
    progress: 0,
  }));
  setUploadProgress(progressArray);

  const updateProgress = (
    fileName: string,
    progress: number,
    status: UploadProgress["status"],
    error?: string
  ) => {
    setUploadProgress(prev =>
      prev.map(p =>
        p.fileName === fileName ? { ...p, progress, status, error } : p
      )
    );
  };

  type ScanCreateResponse = { scanId: string; status?: string; [key: string]: unknown };
  const results: ScanCreateResponse[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    try {
      // Convert file to Base64 with progress
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onloadstart = () => updateProgress(file.name, 0, "uploading");
        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            updateProgress(file.name, percent / 2, "uploading"); // half progress for reading
          }
        };
        reader.onload = () => {
          updateProgress(file.name, 50, "uploading"); // reading done, halfway
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = () => {
          updateProgress(file.name, 0, "error", "File read failed");
          reject(new Error("File read failed"));
        };
      });

      // Call API
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("video/")
            ? "video"
            : "audio",
          base64,
        }),
      });

      const result = await response.json(); // read only once

      if (!response.ok) {
        const errMsg = result.error || "Upload failed";
        setError(errMsg);
        updateProgress(file.name, 0, "error", errMsg);
        setLoading(false);
        continue; // skip this file and continue with the next
      }

      // Success
      results.push(result);
      updateProgress(file.name, 100, "done");
    } catch (err: unknown) {
      console.error("Upload error for", file.name, err);
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : String(err);
      updateProgress(file.name, 0, "error", message);
      setError(message);
      setLoading(false);
    }
  }

  setLoading(false);

  // Navigate to results page if at least one successful file
  if (results.length === 1) {
    router.push(`/results/${results[0].scanId}`);
  } else if (results.length > 1) {
    router.push(`/results/bulk?ids=${results.map(r => r.scanId).join(",")}`);
  }
  
const successfulResults = results.filter(r => r.status === "done");

if (successfulResults.length === 0) {
  return;
}

if (successfulResults.length === 1) {
  console.log("Single upload result:", successfulResults);
  router.push(`/results/${successfulResults[0].scanId}`);
} else {
  console.log("Bulk upload results:", successfulResults);
  router.push(`/results/bulk?ids=${successfulResults.map(r => r.scanId).join(",")}`);
}

};

const handleUrlSubmit = async () => {
  if (!urlInput.trim()) {
    setError("Please enter a URL");
    return;
  }

  if (!isSignedIn) {
    router.push("/login");
    return;
  }

  try {
    setLoading(true);
    setError(null);

    // Normalize
    let normalizedUrl = urlInput.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = "https://" + normalizedUrl;
    }

    // Detect file type from URL
    const fileType = getFileTypeFromUrl(normalizedUrl);

    const result = await createScan({
      fileName: new URL(normalizedUrl).pathname.split("/").pop() || "media-file",
      fileType,
      url: normalizedUrl,
    });

    router.push(`/results/${result.scanId}`);
  } catch (err: unknown) {
    console.error("URL scan error:", err);
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : String(err);
    setError(message || "Failed to scan URL");
  } finally {
    setLoading(false);
  }
};

const getFileTypeFromUrl = (url: string) => {
  const ext = url.split(".").pop()?.toLowerCase();

  if (!ext) return "image";

  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) return "image";
  if (["mp4", "mov", "avi", "webm", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";

  return "image";
};

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white dark:from-background dark:to-background" >
      {/* Hero Section */}
      <section className="mx-auto max-w-4xl text-center px-6 py-14">
        <h1 className="text-4xl md:text-5xl font-bold dark:text-white tracking-tight text-slate-900">
          Secure Media Integrity <br />
          <span className="text-sky-500 dark:text-sky-400">Enterprise-Grade Protection</span>
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-gray-400 max-w-2xl mx-auto">
          Advanced deepfake detection and C2PA provenance verification for newsrooms,
          ensuring authentic media in an age of synthetic content.
        </p>
      </section>

      {/* Upload Area */}
<main className="flex-1">
      <div className="mx-auto max-w-2xl px-6">
<Card className="shadow-lg border border-dashed border-sky-500 dark:border-sky-400 dark:bg-card/50 bg-white rounded-2xl">
  <CardContent className="p-8 space-y-8">
    {error && (
      <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-md text-sm">
        {error}
      </div>
    )}

    {/* File Upload Area */}
    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-sky-500 dark:hover:border-sky-400 rounded-xl p-10 transition bg-white dark:bg-card/50">
      <UploadCloud className="h-12 w-12 text-sky-500 dark:text-sky-400 mb-3" />
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2">
        Upload Media for Verification
      </p>
      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-3">
        <span className="flex items-center gap-1">
          <Video className="h-4 w-4" /> Video
        </span>
        <span className="flex items-center gap-1">
          <ImageIcon className="h-4 w-4" /> Image
        </span>
        <span className="flex items-center gap-1">
          <AudioWaveform className="h-4 w-4" /> Audio
        </span>
      </div>

      {/* Browse Files Button */}
      <Button
        size="lg"
        onClick={() => document.getElementById("file-input")?.click()}
        disabled={loading}
        className="bg-slate-900 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-600 text-white rounded-xl px-6"
      >
        {loading ? "Processing..." : "Browse Files"}
      </Button>

      <input
        type="file"
        id="file-input"
        accept="image/*,video/*,audio/*"
        multiple
        onChange={handleFileUpload}
        style={{ display: "none" }}
        disabled={loading}
      />

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="mt-6 w-full space-y-3">
          {uploadProgress.map((p, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium truncate">{p.fileName}</span>
                <span className="flex items-center gap-1 text-xs">
                  {p.status === "done" && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {p.status === "error" && <XCircle className="h-4 w-4 text-red-600" />}
                  {p.status === "uploading" && <Clock className="h-4 w-4 text-sky-600 animate-spin-slow" />}
                  {p.status === "uploading" && <span>{Math.round(p.progress)}%</span>}
              </span>
              </div>
              {/* Progress Bar */}
              {p.status === "uploading" && (
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-sky-500 dark:bg-sky-400 rounded-full transition-all"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

{/* URL Scan Input + Button */}
<div className="flex w-full flex-col sm:flex-row gap-3 sm:gap-2">
  <input
    type="text"
    placeholder="Paste media URL here..."
    value={urlInput}
    onChange={(e) => setUrlInput(e.target.value)}
    disabled={loading}
    className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm 
               focus:outline-none focus:ring-2 focus:ring-sky-500 
               dark:bg-background/50 dark:text-white disabled:opacity-50
               w-full"
  />

  <Button
    size="default"
    onClick={handleUrlSubmit}
    disabled={loading}
    className="bg-slate-900 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-600 
               text-white rounded-md px-4 
               w-full sm:w-auto"  // full width on mobile, auto width otherwise
  >
    {loading ? "Processing..." : "Add File"}
  </Button>
</div>

    <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-4">
      1 scan = 1 credit. Enterprise plans start at 500 credits/month.
    </p>

    <p className="text-xs text-slate-500 dark:text-slate-200 text-center">
      Max file size: 300MB. Accepted formats: JPG, PNG, MP3, WAV, MP4, WebM, MOV, AVI, WMV, MKV, FLV
    </p>
  </CardContent>
</Card>
      </div>
    </main>
<div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6 mb-8 mt-10 px-6">
  {/* AI-Powered Detection */}
  <Card className="bg-card/60 border dark:border-gray-800 shadow-lg rounded-lg flex flex-col items-center justify-center text-center p-6">
    <CardHeader className="flex items-center justify-center">
      <div className="flex items-center justify-center p-2 rounded-full bg-green-500/10">
        <Shield className="h-8 w-8 text-green-400/70" />
      </div>
    </CardHeader>
    <CardContent>
      <CardTitle className="text-gray-500 dark:text-gray-200 text-base font-semibold mb-2">
        AI-Powered Detection
      </CardTitle>
      <p className="text-sm text-gray-400">
        Overview of all claims submitted to the system.
      </p>
    </CardContent>
  </Card>

  {/* C2PA Provenance */}
  <Card className="bg-card/60 border dark:border-gray-800 shadow-lg rounded-lg flex flex-col items-center justify-center text-center p-6">
    <CardHeader className="flex items-center justify-center">
      <div className="flex items-center justify-center p-2 rounded-full bg-slate-400/10">
        <Globe className="h-8 w-8 text-slate-400/70" />
      </div>
    </CardHeader>
    <CardContent>
      <CardTitle className="text-gray-500 dark:text-gray-200 text-base font-semibold mb-2">
        C2PA Provenance
      </CardTitle>
      <p className="text-sm text-gray-400">
        Complete media lineage tracking and authenticity verification
      </p>
    </CardContent>
  </Card>

  {/* Enterprise Ready */}
  <Card className="bg-card/60 border dark:border-gray-800 shadow-lg rounded-lg flex flex-col items-center justify-center text-center p-6">
    <CardHeader className="flex items-center justify-center">
      <div className="flex items-center justify-center p-2 rounded-full bg-yellow-500/10">
        <UsersRound className="h-8 w-8 text-yellow-500/70" />
      </div>
    </CardHeader>
    <CardContent>
      <CardTitle className="text-gray-500 dark:text-gray-200 text-base font-semibold mb-2">
        Enterprise Ready
      </CardTitle>
      <p className="text-sm text-gray-400">
        Multi-tenant architecture with advanced user management
      </p>
    </CardContent>
  </Card>
</div>
        </div>
  );
}
