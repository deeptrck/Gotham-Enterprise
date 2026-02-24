"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { fetchScans, fetchResult } from "@/lib/api";
import { useUser } from "@clerk/nextjs";
import { mapToPdfDto, handleDownloadPDF } from "@/components/pdfUtils";
import LoadingSpinner from "@/components/ui/loading-spinner";
import * as Sentry from "@sentry/nextjs";

type ScanRecord = {
  _id: string;
  scanId: string;
  fileName: string;
  date: string;
  status: "Authentic" | "Suspicious" | "Deepfake";
  createdAt: string;
};

const statusColors: Record<ScanRecord["status"], string> = {
  Authentic: "text-green-600 dark:text-green-400",
  Suspicious: "text-yellow-600 dark:text-yellow-400",
  Deepfake: "text-red-600 dark:text-red-400",
};

const tabs = ["All scans", "Authentic", "Suspicious", "Deepfake"];

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<string>("All scans");
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { isSignedIn } = useUser();

  useEffect(() => {
    if (!isSignedIn) return;

    const loadScans = async () => {
      try {
        setLoading(true);
        const data = await fetchScans();
        type ApiScan = { _id: string; scanId: string; fileName: string; createdAt: string; status: string };
        const formattedScans: ScanRecord[] = (data as ApiScan[]).map((scan) => ({
          _id: scan._id,
          scanId: scan.scanId,
          fileName: scan.fileName,
          date: new Date(scan.createdAt).toLocaleDateString(),
          status:
            scan.status.toLowerCase() === "authentic"
              ? "Authentic"
              : scan.status.toLowerCase() === "suspicious"
              ? "Suspicious"
              : "Deepfake",
          createdAt: scan.createdAt,
        }));
        setScans(formattedScans);
      } catch (error) {
        console.error("Failed to load scans:", error);
        Sentry.captureException(error);
        setScans([]);
      } finally {
        setLoading(false);
      }
    };

    loadScans();
  }, [isSignedIn]);

  const filteredScans =
    activeTab === "All scans" ? scans : scans.filter((scan) => scan.status === activeTab);

  const handleViewResults = (scanId: string) => {
    router.push(`/results/${scanId}`);
  };

  const handleDownload = async (scanId: string) => {
    try {
      const scanData = await fetchResult(scanId);
      const pdfDto = mapToPdfDto(scanData);

      if (!pdfDto) {
        console.error("Cannot generate PDF: invalid scan data", scanData);
        return;
      }

      handleDownloadPDF(pdfDto);
    } catch (err) {
      console.error("Failed to download PDF:", err);
      Sentry.captureException(err);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="inline-block rotate-[-15deg] text-2xl">⟳</span> HISTORY
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-800">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading && <LoadingSpinner message="Loading scan history..." />}

        {!loading && (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
                  <th className="px-4">Name</th>
                  <th className="px-4">Date</th>
                  <th className="px-4">Status</th>
                  <th className="px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredScans.length > 0 ? (
                  filteredScans.map((scan) => (
                    <tr
                      key={scan._id}
                      className="bg-white dark:bg-black shadow-sm rounded-md overflow-hidden border border-gray-200 dark:border-transparent"
                    >
                      <td className="px-4 py-3 font-medium">{scan.fileName}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{scan.date}</td>
                      <td className={`px-4 py-3 font-semibold ${statusColors[scan.status]}`}>
                        {scan.status}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900">
                              <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </button>
                          </DropdownMenu.Trigger>

                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              sideOffset={4}
                              className="bg-white dark:bg-black rounded-md shadow-md border border-gray-200 dark:border-transparent py-1 min-w-[150px] text-sm"
                            >
                              <DropdownMenu.Item
                                onClick={() => handleViewResults(scan.scanId)}
                                className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer text-black dark:text-white"
                              >
                                View Results
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                onClick={() => handleDownload(scan.scanId)}
                                className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer text-black dark:text-white"
                              >
                                Download Report
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm italic"
                    >
                      No scans found for this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
