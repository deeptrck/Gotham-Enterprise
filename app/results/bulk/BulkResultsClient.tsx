"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Check, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { fetchResult } from "@/lib/api";
import { useUser } from "@clerk/nextjs";
import * as Sentry from "@sentry/nextjs";

// --- Model map (same as single results page) ---
const modelMap: Record<string, { label: string; description: string }> = {
  "rd-img-ensemble": {
    label: "Facial Analysis",
    description: "Combines fakeness scores from all facial-recognition models.",
  },
  "rd-oak-img": {
    label: "Faceswaps",
    description: "Detects face-manipulated images created through faceswap.",
  },
  "rd-elm-img": {
    label: "Diffusion",
    description: "Detects AI diffusion-generated fake media.",
  },
  "rd-cedar-img": {
    label: "GANs",
    description: "Detects manipulations from GAN-based image generation.",
  },
  "rd-pine-img": {
    label: "Noise Analysis",
    description: "Analyzes texture + noise to detect inconsistencies.",
  },
  "rd-context-img": {
    label: "Context Awareness",
    description: "Evaluates background + full-image inconsistencies.",
  },
};

// --- Types ---
interface RDModel {
  name: string;
  status: string;
  score: number;
}

interface ResultData {
  fileName: string;
  scanId: string;
  status: string;
  confidenceScore: number;
  createdAt: string;
  fileType: string;
  modelsUsed: string[];
  imageUrl: string;
  description: string;
  features: string[];
  rdModels: RDModel[];
}

// --- Card Component ---
const ResultCard: React.FC<{ result: ResultData }> = ({ result }) => (
  <div className="bg-white dark:bg-black rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-800 flex flex-col">
    {/* Image */}
    <div className="w-full h-[180px] rounded-lg overflow-hidden mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <Image
        src={result.imageUrl}
        alt={result.fileName}
        width={280}
        height={180}
        className="object-cover w-full h-full"
      />
    </div>

    {/* File name & status */}
    <h2 className="font-semibold text-lg mb-2">{result.fileName}</h2>
    <p className="text-sm mb-1">
      <span className="font-semibold">Status: </span>
      <span
        className={`font-semibold px-2 py-1 rounded-md ${
          result.status === "AUTHENTIC"
            ? "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40"
            : result.status === "SUSPICIOUS"
            ? "text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40"
            : "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40"
        }`}
      >
        {result.status}
      </span>
    </p>

    <p className="text-sm mb-1">
      <span className="font-semibold">Confidence:</span> {result.confidenceScore}%
    </p>

    <p className="text-sm mb-3">
      <span className="font-semibold">Scan ID:</span> {result.scanId}
    </p>

{/* Compact RD Models List */}
{result.rdModels.length > 0 && (
  <ul className="text-sm text-gray-700 dark:text-gray-400 space-y-1 mt-2">
    {result.rdModels.map((model, idx) => {
      const mapped = modelMap[model.name];
      const label = mapped?.label || model.name;

      let iconColor = "text-yellow-500";
      let Icon = Check; // default to check
      if (model.status === "MANIPULATED") {
        Icon = XCircle;
        iconColor = "text-red-600";
      } else if (model.status === "AUTHENTIC") {
        Icon = Check;
        iconColor = "text-green-600";
      } else if (model.status === "SUSPICIOUS") {
        Icon = AlertCircle;
        iconColor = "text-yellow-500";
      }

      return (
        <li key={idx} className="flex items-center gap-2">
          <Icon className={`${iconColor} w-4 h-4 flex-shrink-0`} />
          <span>{label}</span>
          <span className="ml-auto text-xs opacity-80">
            {(model.score * 100).toFixed(1)}%
          </span>
        </li>
      );
    })}
  </ul>
)}

  </div>
);

// --- Bulk Results Component ---
export default function BulkResultsClient() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") || "";
  const { isSignedIn } = useUser();

  const [results, setResults] = useState<ResultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !idsParam) return;

    const scanIds = idsParam.split(",").map((id) => id.trim()).filter(Boolean);

    if (!scanIds.length) {
      setError("No valid scan IDs provided.");
      setLoading(false);
      return;
    }

    const loadResults = async () => {
      try {
        const fetchedResults: ResultData[] = [];

        for (const id of scanIds) {
          try {
            const data = await fetchResult(id);

            // Parse RD models
            let rdModels: RDModel[] = [];
            try {
              const parsed = data.description ? JSON.parse(data.description) : {};
              const rd = parsed?.rd as { models?: Partial<RDModel>[] } | undefined;
              if (rd?.models?.length) {
                rdModels = rd.models.map((m) => ({
                  name: String(m.name || "unknown"),
                  status: String(m.status || "UNKNOWN"),
                  score: typeof m.score === "number" ? m.score : Number(m.score) || 0,
                }));
              }
            } catch (err) {
              Sentry.captureException(err);
              console.warn("Failed to parse RD result:", err);
            }

            fetchedResults.push({
              fileName: data.fileName || "Unknown",
              scanId: data.scanId,
              status: data.status,
              confidenceScore: data.confidenceScore ?? 0,
              createdAt: data.createdAt,
              fileType: data.fileType ?? "unknown",
              modelsUsed: data.modelsUsed ?? [],
              imageUrl: data.imageUrl || "https://via.placeholder.com/280x180.png?text=Detected+Image",
              description:
                data.description ||
                "deeptrack is an advanced deepfake detection solution designed for media outlets, financial institutions, and government agencies",
              features:
                data.features || [
                  "Advanced AI models trained on millions of authentic and manipulated images",
                  "Ensemble approach using multiple specialized detection algorithms",
                  "Real-time detection of deepfakes, AI-generated content, and manipulations",
                ],
              rdModels,
            });
          } catch (err) {
            Sentry.captureException(err);
            console.error(`Failed to fetch result ${id}`, err);
          }
        }

        setResults(fetchedResults);
      } catch (err) {
        console.error("Failed to load bulk results:", err);
        Sentry.captureException(err);
        setError("Failed to load bulk results.");
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [isSignedIn, idsParam]);

  if (!idsParam) return <p className="text-center mt-8">No scan IDs provided</p>;
  if (loading) return <p className="text-center mt-8">Loading results...</p>;
  if (error) return <p className="text-center mt-8 text-red-500">{error}</p>;

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white px-6 py-8">
      <div className="w-full bg-gradient-to-r from-sky-600 to-sky-500 text-white py-10 shadow-lg mb-10">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl font-bold flex items-center gap-3">Bulk Scan Overview</h1>
          <p className="opacity-80 mt-1">Summary of your uploaded media analysis</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((res) => (
          <ResultCard key={res.scanId} result={res} />
        ))}
      </div>
    </div>
  );
}
