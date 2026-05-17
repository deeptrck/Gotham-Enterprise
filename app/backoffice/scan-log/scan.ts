export interface Scan {
  id: string;
  client: string;
  file: string;
  type: MediaType;
  verdict: Verdict;
  confidence: number;
  credits: number;
  processingMs: number;
  reviewStatus: "pending" | "confirmed" | "dismissed" | null;
  time: string;
  date: string;
  apiKey: string;
  rdScore: number;
  dtScore: number;
  ensemble: number;
  fileSize: string;
  duration?: string;
  codec?: string;
}

export type Verdict = "authentic" | "deepfake" | "review" | "processing";
export type MediaType = "Video" | "Audio" | "Image" | "Document";