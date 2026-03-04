type JobMeta = {
  userId: string;
  fileName: string;
  fileType: "image" | "video" | "audio";
  source?: "fakecatcher" | "rd-only";
  createdAt: string;
};

export type RdModel = {
  name: string;
  status: string;
  score: number;
};

export type RdAnalysis = {
  requestId?: string;
  status: string;
  score: number;
  models: RdModel[];
  analyzedAt: string;
  error?: string;
};

export type FeedbackLabel = "FALSE_POSITIVE" | "FALSE_NEGATIVE";

type FeedbackEntry = {
  userId: string;
  label: FeedbackLabel;
  comment?: string;
  createdAt: string;
};

const jobMetaStore = new Map<string, JobMeta>();
const jobFeedbackStore = new Map<string, FeedbackEntry[]>();
const jobAnalysisStore = new Map<string, { rd?: RdAnalysis }>();

export function setJobMeta(jobId: string, meta: JobMeta) {
  jobMetaStore.set(jobId, meta);
}

export function getJobMeta(jobId: string) {
  return jobMetaStore.get(jobId);
}

export function listUserJobMeta(userId: string) {
  return Array.from(jobMetaStore.entries())
    .filter(([, meta]) => meta.userId === userId)
    .map(([jobId, meta]) => ({ jobId, ...meta }));
}

export function upsertJobFeedback(
  jobId: string,
  payload: { userId: string; label: FeedbackLabel; comment?: string }
) {
  const existing = jobFeedbackStore.get(jobId) || [];
  const withoutCurrentUser = existing.filter((entry) => entry.userId !== payload.userId);

  const nextEntry: FeedbackEntry = {
    userId: payload.userId,
    label: payload.label,
    comment: payload.comment,
    createdAt: new Date().toISOString(),
  };

  const next = [...withoutCurrentUser, nextEntry];
  jobFeedbackStore.set(jobId, next);
  return nextEntry;
}

export function getUserJobFeedback(jobId: string, userId: string) {
  return (jobFeedbackStore.get(jobId) || []).find((entry) => entry.userId === userId) || null;
}

export function getJobFeedbackSummary(jobId: string) {
  const all = jobFeedbackStore.get(jobId) || [];

  return all.reduce(
    (acc, entry) => {
      if (entry.label === "FALSE_POSITIVE") acc.falsePositive += 1;
      if (entry.label === "FALSE_NEGATIVE") acc.falseNegative += 1;
      acc.total += 1;
      return acc;
    },
    { falsePositive: 0, falseNegative: 0, total: 0 }
  );
}

export function setJobRdAnalysis(jobId: string, analysis: RdAnalysis) {
  const existing = jobAnalysisStore.get(jobId) || {};
  jobAnalysisStore.set(jobId, {
    ...existing,
    rd: analysis,
  });
}

export function getJobRdAnalysis(jobId: string) {
  return jobAnalysisStore.get(jobId)?.rd;
}
