import { Scan } from "@/app/backoffice/scan-log/scan";
import { useEffect, useState } from "react";

export function useScanData() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    total_deepfakes: 0,
    total_pending_review: 0,
    fp_pending: 0,
    fn_pending: 0,
    avg_confidence: 0,
  });

  const fetchScans = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/scans?limit=100", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setScans(data.scans);
        setTotal(data.pagination?.total || 0);
        setSummary(data.summary || {
          total_deepfakes: 0,
          total_pending_review: 0,
          fp_pending: 0,
          fn_pending: 0,
          avg_confidence: 0,
        });
      }
    } catch (err) {
      console.error("Error fetching scans:", err);
      setError("Failed to load scans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScans();
  }, []);

  return { scans, loading, error, total, summary, refetch: fetchScans };
}
