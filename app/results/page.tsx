import React, { Suspense } from "react";
import ResultsClient from "./ResultsClient";

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      {/* ResultsClient is a client component that uses `useSearchParams` and other client hooks */}
      <ResultsClient />
    </Suspense>
  );
}