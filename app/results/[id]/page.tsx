"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { fetchResult, submitResultFeedback } from "@/lib/api";
import { useUser } from "@clerk/nextjs";
import { FileDown } from "lucide-react";
import { mapToPdfDto, handleDownloadPDF } from "@/components/pdfUtils";
import * as Sentry from "@sentry/nextjs";

type RdModel = {
  name: string;
  status: "MANIPULATED" | "AUTHENTIC" | "SUSPICIOUS" | string;
  score: number;
};

type ResultData = {
  fileName: string;
  scanId: string;
  fileType?: string;
  status: string;
  confidenceScore: number;
  createdAt: string;
  imageUrl: string;
  description?: string;
  modelsUsed: string[];
  fakecatcherSummary?: {
    confidence?: number;
    fake_prob?: number;
    label?: string;
  } | null;
  feedbackSummary?: {
    falsePositive: number;
    falseNegative: number;
    total: number;
  };
  userFeedback?: {
    label: "FALSE_POSITIVE" | "FALSE_NEGATIVE";
    createdAt: string;
  } | null;
};

const modelMap: Record<string, { label: string; description: string }> = {
  "rd-img-ensemble": { label: "Facial Analysis", description: "Combines fakeness scores from all facial-recognition models." },
  "rd-oak-img": { label: "Faceswaps", description: "Detects face-manipulated images created through faceswap." },
  "rd-elm-img": { label: "Diffusion", description: "Detects AI diffusion-generated fake media." },
  "rd-cedar-img": { label: "GANs", description: "Detects manipulations from GAN-based image generation." },
  "rd-pine-img": { label: "Noise Analysis", description: "Analyzes texture + noise to detect inconsistencies." },
  "rd-context-img": { label: "Context Awareness", description: "Evaluates background + full-image inconsistencies." },
};

export default function ResultsPage() {
  const { id } = useParams();
  const { isSignedIn } = useUser();
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState<"FALSE_POSITIVE" | "FALSE_NEGATIVE" | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

type ParsedDescription = {
  rd?: {
    models?: {
      name: string;
      status: "MANIPULATED" | "AUTHENTIC" | "SUSPICIOUS" | string;
      score: number;
    }[];
    fakecatcher?: {
      confidence?: number;
      fake_prob?: number;
      label?: string;
    };
    realityDefender?: {
      status?: string;
      score?: number;
      error?: string;
    };
    fusion?: {
      score?: number;
      status?: string;
      weights?: {
        fakecatcher?: number;
        realityDefender?: number;
      };
    };
  };
};

useEffect(() => {
  if (!isSignedIn || !id) return;

  const load = async () => {
    try {
    const scanId = Array.isArray(id) ? id[0] : id;

    if (!scanId) {
      console.error("No scan ID provided");
      return;
    }

      const data = await fetchResult(scanId);

      let parsed: ParsedDescription = {};
      try {
        parsed = JSON.parse(data.description || "{}") as ParsedDescription;
      } catch {
        parsed = {};
      }

      setResultData({
        fileName: data.fileName,
        scanId: data.scanId,
        fileType: data.fileType,
        status: data.status,
        confidenceScore: data.confidenceScore,
        createdAt: data.createdAt,
        imageUrl: data.imageUrl || "",
        description: data.description,
        modelsUsed: data.modelsUsed || [],
        fakecatcherSummary: parsed.rd?.fakecatcher || null,
        feedbackSummary: data.feedbackSummary,
        userFeedback: data.userFeedback,
      });
    } catch (err) {
      setError("Failed to load result");
      Sentry.captureException(err);
    } finally {
      setLoading(false);
    }
  };

  load();
}, [isSignedIn, id]);

  const handleFeedbackClick = async (label: "FALSE_POSITIVE" | "FALSE_NEGATIVE") => {
    if (!resultData) return;

    setFeedbackLoading(label);
    setFeedbackMessage(null);

    try {
      const response = await submitResultFeedback(resultData.scanId, label);

      setResultData((prev) =>
        prev
          ? {
              ...prev,
              feedbackSummary: response.summary,
              userFeedback: response.userFeedback,
            }
          : prev
      );

      setFeedbackMessage("Feedback saved. Thank you.");
    } catch (err) {
      setFeedbackMessage(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setFeedbackLoading(null);
    }
  };

  if (loading)
    return <div className="h-screen flex items-center justify-center">Loading…</div>;

  if (error || !resultData)
    return (
      <div className="h-screen flex items-center justify-center text-red-500">
        {error}
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-200">
      {/* Header */}
      <div className="w-full bg-gradient-to-r from-sky-600 to-sky-500 text-white py-10 shadow-lg mb-10">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            Deeptrack Analysis Results
          </h1>
          <p className="opacity-80 mt-1">Comprehensive deepfake detection report</p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto w-full px-6 pb-16">
        {/* Download Button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => {
              if (!resultData) return;
              const dto = mapToPdfDto(resultData);
              if (!dto) return;
              handleDownloadPDF(dto);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-400 text-white rounded-lg shadow-md hover:bg-sky-500 transition"
          >
            <FileDown className="w-4 h-4" />
            Download PDF
          </button>
        </div>

        {/* Top Section */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-neutral-800 flex flex-col md:flex-row gap-10">
          {/* Image */}
          <div className="w-full md:w-[300px]">
            {resultData.imageUrl ? (
              resultData.fileType === "video" ? (
                <div className="rounded-xl overflow-hidden shadow-md border border-gray-200 dark:border-neutral-800">
                  <video
                    controls
                    className="w-full h-[260px] object-cover"
                    src={resultData.imageUrl}
                  />
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden shadow-md border border-gray-200 dark:border-neutral-800">
                  <img
                    src={resultData.imageUrl}
                    alt={resultData.fileName}
                    className="w-full h-[260px] object-cover"
                  />
                </div>
              )
            ) : (
              <div className="rounded-xl overflow-hidden shadow-md border border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-gray-800 flex items-center justify-center h-[260px]">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">
                    {resultData.fileType === "video" ? "🎥" : resultData.fileType === "audio" ? "🎵" : "📄"}
                  </div>
                  <p className="text-sm">No preview available</p>
                  <p className="text-xs mt-1">{resultData.fileType?.toUpperCase()}</p>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-center">
              Uploaded: {resultData.fileName}
            </p>
          </div>

          {/* Metadata */}
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mb-6">{resultData.fileName}</h2>
            <div className="grid grid-cols-2 gap-y-3 text-lg">
              <p><span className="font-semibold">Status:</span> {resultData.status}</p>
              <p><span className="font-semibold">Confidence:</span> {resultData.confidenceScore}%</p>
              <p><span className="font-semibold">Scan ID:</span> {resultData.scanId}</p>
              <p><span className="font-semibold">Uploaded:</span> {new Date(resultData.createdAt).toLocaleString()}</p>
              <p><span className="font-semibold">Models Used:</span> {resultData.modelsUsed.length}</p>
              <p><span className="font-semibold">File Type:</span> {resultData.fileType}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-neutral-800">
          <h3 className="text-lg font-semibold mb-3">DeepTrack result</h3>
          <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-3 text-sm">
            <p className="font-semibold mb-1">FakeCatcher</p>
            <p>Label: {resultData.fakecatcherSummary?.label || "N/A"}</p>
            <p>Fake probability: {typeof resultData.fakecatcherSummary?.fake_prob === "number" ? `${(resultData.fakecatcherSummary.fake_prob * 100).toFixed(1)}%` : "N/A"}</p>
            <p>Confidence: {typeof resultData.fakecatcherSummary?.confidence === "number" ? `${resultData.fakecatcherSummary.confidence.toFixed(1)}%` : "N/A"}</p>
          </div>
        </div>

        <div className="mt-6 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-neutral-800">
          <h3 className="text-lg font-semibold mb-3">Result feedback</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Help improve detection quality by marking this result if it was incorrect.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleFeedbackClick("FALSE_POSITIVE")}
              disabled={feedbackLoading !== null}
              className={`px-4 py-2 rounded-lg border transition ${
                resultData.userFeedback?.label === "FALSE_POSITIVE"
                  ? "bg-yellow-100 border-yellow-400 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300"
                  : "bg-white border-gray-300 text-gray-800 hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-gray-200"
              } disabled:opacity-60`}
            >
              {feedbackLoading === "FALSE_POSITIVE" ? "Saving..." : "Mark as False Positive"}
            </button>

            <button
              onClick={() => handleFeedbackClick("FALSE_NEGATIVE")}
              disabled={feedbackLoading !== null}
              className={`px-4 py-2 rounded-lg border transition ${
                resultData.userFeedback?.label === "FALSE_NEGATIVE"
                  ? "bg-red-100 border-red-400 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300"
                  : "bg-white border-gray-300 text-gray-800 hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-gray-200"
              } disabled:opacity-60`}
            >
              {feedbackLoading === "FALSE_NEGATIVE" ? "Saving..." : "Mark as False Negative"}
            </button>
          </div>

          <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            {resultData.feedbackSummary?.total
              ? `Community feedback: ${resultData.feedbackSummary.falsePositive} false positive, ${resultData.feedbackSummary.falseNegative} false negative`
              : "No feedback yet for this result."}
          </div>

          {feedbackMessage && (
            <p className="mt-2 text-sm text-sky-600 dark:text-sky-400">{feedbackMessage}</p>
          )}
        </div>

      </main>
    </div>
  );
}
