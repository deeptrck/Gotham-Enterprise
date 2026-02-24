"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fetchAllResults } from "@/lib/api";
import { useUser } from "@clerk/nextjs";
import LoadingSpinner from "@/components/ui/loading-spinner";
import * as Sentry from "@sentry/nextjs";

interface ScanResult {
  _id: string;
  fileName: string;
  scanId: string;
  status: string;
  confidenceScore: number;
  createdAt: string;
  fileType: string;
  imageUrl?: string;
  description?: string;
  modelsUsed?: string[];
  features?: string[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function ResultsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useUser();

  const [results, setResults] = useState<ScanResult[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  useEffect(() => {
    if (!isSignedIn) return;

    const loadResults = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchAllResults(currentPage, 20);
        setResults(data.data || []);
        setPagination(data.pagination);
      } catch (err) {
        console.error("Failed to load results:", err);
        Sentry.captureException(err);
        setError(err instanceof Error ? err.message : "Failed to load results");
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [isSignedIn, currentPage]);

  const handlePrevious = () => {
    if (pagination?.hasPrevPage) {
      router.push(`/results?page=${currentPage - 1}`);
    }
  };

  const handleNext = () => {
    if (pagination?.hasNextPage) {
      router.push(`/results?page=${currentPage + 1}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "AUTHENTIC":
        return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400";
      case "SUSPICIOUS":
        return "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400";
      case "DEEPFAKE":
        return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400";
      default:
        return "bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-400";
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading scan results..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-black dark:text-white">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">Scan Results</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Total scans: <span className="font-semibold">{pagination?.total || 0}</span>
          </p>
        </div>

        {results.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-12 text-center border border-gray-200 dark:border-gray-800">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No scan results yet.</p>
            <button
              onClick={() => router.push("/")}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              Start Scanning
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {results.map((result) => (
                <div
                  key={result._id}
                  onClick={() => router.push(`/results/${result.scanId}`)}
                  className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden hover:shadow-lg dark:hover:shadow-lg dark:hover:shadow-blue-500/20 hover:shadow-blue-300/20 cursor-pointer transition-all hover:border-blue-400 dark:hover:border-blue-600"
                >
                  <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                    {result.imageUrl ? (
                      <Image
                        src={result.imageUrl}
                        alt={result.fileName}
                        fill
                        className="object-cover hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://via.placeholder.com/300x200?text=Image";
                        }}
                      />
                    ) : (
                      <span className="text-gray-400">No image</span>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="text-lg font-semibold truncate mb-2">{result.fileName}</h3>

                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-medium px-3 py-1 rounded-full ${getStatusColor(result.status)}`}>
                        {result.status}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">
                        {Math.round(result.confidenceScore)}%
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <p>
                        <span className="font-semibold">Type:</span> {result.fileType}
                      </p>
                      <p>
                        <span className="font-semibold">Date:</span> {new Date(result.createdAt).toLocaleDateString()}
                      </p>
                      <p className="truncate">
                        <span className="font-semibold">ID:</span> {result.scanId.substring(0, 20)}...
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                <button
                  onClick={handlePrevious}
                  disabled={!pagination.hasPrevPage}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <div className="text-center">
                  <p className="text-sm font-semibold">
                    Page <span className="text-blue-600 dark:text-blue-400">{pagination.page}</span> of {" "}
                    <span className="text-blue-600 dark:text-blue-400">{pagination.pages}</span>
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to {" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                  </p>
                </div>

                <button
                  onClick={handleNext}
                  disabled={!pagination.hasNextPage}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
