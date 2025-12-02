"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { fetchResult } from "@/lib/api";
import { useUser } from "@clerk/nextjs";
import { FileDown } from "lucide-react";
import { mapToPdfDto, handleDownloadPDF } from "@/components/pdfUtils";

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
  modelsUsed: string[];
  rdModels: RdModel[];
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

type ParsedDescription = {
  rd?: {
    models?: {
      name: string;
      status: "MANIPULATED" | "AUTHENTIC" | "SUSPICIOUS" | string;
      score: number;
    }[];
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

      const rdModels = parsed.rd?.models?.map((m) => ({
        name: m.name,
        status: m.status,
        score: typeof m.score === "number" ? m.score : 0,
      })) || [];

      setResultData({
        fileName: data.fileName,
        scanId: data.scanId,
        fileType: data.fileType,
        status: data.status,
        confidenceScore: data.confidenceScore,
        createdAt: data.createdAt,
        imageUrl: data.imageUrl || "https://via.placeholder.com/260x180.png?text=Image",
        modelsUsed: data.modelsUsed || [],
        rdModels,
      });
    } catch {
      setError("Failed to load result");
    } finally {
      setLoading(false);
    }
  };

  load();
}, [isSignedIn, id]);

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
          disabled={!resultData}
          onClick={() => handleDownloadPDF(mapToPdfDto(resultData!))}
        >
        <FileDown className="w-4 h-4" />
        Download PDF
      </button>
        </div>

        {/* Top Section */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-neutral-800 flex flex-col md:flex-row gap-10">
          {/* Image */}
          <div className="w-full md:w-[300px]">
            <div className="rounded-xl overflow-hidden shadow-md border border-gray-200 dark:border-neutral-800">
              <Image
                src={resultData.imageUrl}
                alt={resultData.fileName}
                width={300}
                height={260}
                className="object-cover"
              />
            </div>
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

        {/* Model Results */}
        <h3 className="mt-12 mb-4 text-xl font-semibold">Model Analysis Breakdown</h3>

        <div className="flex flex-col gap-5">
          {resultData.rdModels.map((model, index) => {
            const mapped = modelMap[model.name];
            const label = mapped?.label || model.name;
            const description = mapped?.description || "";

            const statusColor =
              model.status === "MANIPULATED"
                ? "border-red-600/80 bg-red-600/10"
                : model.status === "AUTHENTIC"
                ? "border-green-600/80 bg-green-600/10"
                : "border-yellow-500/80 bg-yellow-500/10";

            return (
              <div
                key={index}
                className={`rounded-xl border-l-8 p-5 shadow-md ${statusColor} border dark:border-neutral-800`}
              >
                <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
                  <div>
                    <h4 className="text-lg font-semibold">{label}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">
                      {description}
                    </p>
                  </div>
                  <div className="w-full sm:w-52">
                    <p className="text-xs mb-1 opacity-80">
                      Confidence: {(model.score * 100).toFixed(1)}%
                    </p>
                    <div className="w-full bg-gray-300 dark:bg-neutral-700 h-2 rounded-full">
                      <div
                        className={`h-2 rounded-full ${
                          model.status === "MANIPULATED"
                            ? "bg-red-600"
                            : model.status === "AUTHENTIC"
                            ? "bg-green-600"
                            : "bg-yellow-500"
                        }`}
                        style={{ width: `${model.score * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
