"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { fetchScans } from "@/lib/api";
import { useUser } from "@clerk/nextjs";

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

  // Memoized data formatting
  const formatScans = useCallback((data: any[]): ScanRecord[] => {
    return data.map((scan) => ({
      _id: scan._id,
      scanId: scan.scanId,
      fileName: scan.fileName,
      date: new Date(scan.createdAt).toLocaleDateString(),
      status: scan.status.toLowerCase() === "authentic" ? "Authentic" :
              scan.status.toLowerCase() === "suspicious" ? "Suspicious" : "Deepfake",
      createdAt: scan.createdAt,
    }));
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;

    const loadScans = async () => {
      try {
        setLoading(true);
        const data = await fetchScans();
        setScans(formatScans(data));
      } catch (error) {
        console.error("Failed to load scans:", error);
        setScans([]);
      } finally {
        setLoading(false);
      }
    };

    loadScans();
  }, [isSignedIn, formatScans]);

  // Memoized filtered scans
  const filteredScans = useMemo(() => {
    return activeTab === "All scans"
      ? scans
      : scans.filter((scan: ScanRecord) => scan.status === activeTab);
  }, [scans, activeTab]);

  const handleViewResults = useCallback((scanId: string) => {
    router.push(`/results/${scanId}`);
  }, [router]);

  // Memoized tab buttons to prevent unnecessary re-renders
  const tabButtons = useMemo(() => 
    tabs.map((tab) => (
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
    )), [activeTab]
  );

  // Memoized table rows
  const tableRows = useMemo(() => {
    if (filteredScans.length === 0) {
      return (
        <tr>
          <td
            colSpan={4}
            className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm italic"
          >
            No scans found for this category.
          </td>
        </tr>
      );
    }

    return filteredScans.map((scan: ScanRecord) => (
      <tr
        key={scan._id}
        className="
          bg-white dark:bg-black 
          shadow-sm rounded-md overflow-hidden
          border border-gray-200 dark:border-transparent
        "
      >
        <td className="px-4 py-3 font-medium truncate max-w-xs" title={scan.fileName}>
          {scan.fileName}
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
          {scan.date}
        </td>
        <td className={`px-4 py-3 font-semibold whitespace-nowrap ${statusColors[scan.status]}`}>
          {scan.status}
        </td>
        <td className="px-4 py-3 text-center">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button 
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                aria-label="Open actions menu"
              >
                <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                sideOffset={4}
                className="
                  bg-white dark:bg-black 
                  rounded-md shadow-lg 
                  border border-gray-200 dark:border-gray-800
                  py-1 min-w-[150px] text-sm z-50
                "
              >
                <DropdownMenu.Item
                  onClick={() => handleViewResults(scan.scanId)}
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer text-black dark:text-white outline-none"
                >
                  View Results
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer text-black dark:text-white outline-none"
                >
                  Download Report
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </td>
      </tr>
    ));
  }, [filteredScans, handleViewResults]);

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
        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
          {tabButtons}
        </div>

        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2 whitespace-nowrap">Date</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {tableRows}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}