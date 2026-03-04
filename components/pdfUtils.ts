import jsPDF from "jspdf";
import autoTable,{ UserOptions } from "jspdf-autotable";

export interface ResultData {
  fileName: string;
  scanId: string;
  fileType?: string;
  status: string;
  confidenceScore: number;
  createdAt: string;
  imageUrl: string;
  description?: string;
}

export interface RdModel {
  name?: string;
  status?: string;
  score?: number;
}

export interface PdfResultDto {
  fileName?: string;
  fileType?: string;
  uploadedAt?: string | Date;
  status?: string;
  confidenceScore?: number;
  models?: Array<{ name: string; status?: string; score?: number }>;
  fileMeta?: { name?: string; type?: string; size?: number };
  description?: string;

  // Missing fields that your mapper returns:
  scanId?: string;
  createdAt?: string | Date;
  imageUrl?: string;
  fusion?: {
    score?: number;
    status?: string;
    weights?: {
      fakecatcher?: number;
      realityDefender?: number;
    };
  };
  fakecatcher?: {
    confidence?: number;
    fake_prob?: number;
    label?: string;
  } | null;
  realityDefender?: {
    status?: string;
    score?: number;
  } | null;
}


interface RdModelsContainer {
  models?: RdModel[];
}

interface ParsedDescription {
  rd?: RdModelsContainer & {
    fakecatcher?: {
      confidence?: number;
      fake_prob?: number;
      label?: string;
    };
    realityDefender?: {
      status?: string;
      score?: number;
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
}

export function mapToPdfDto(resultData: ResultData | null): PdfResultDto | null {
  if (!resultData) return null;

  let models: RdModel[] = [];
  let fusion: PdfResultDto["fusion"];
  let fakecatcher: PdfResultDto["fakecatcher"] = null;
  let realityDefender: PdfResultDto["realityDefender"] = null;

  try {
    const parsedRaw: unknown = JSON.parse(resultData.description || "{}");

    // Type guard for object with optional "rd" containing models array
    function isParsedDescription(obj: unknown): obj is ParsedDescription {
      if (typeof obj !== "object" || obj === null) return false;

      const maybeRd = (obj as { rd?: unknown }).rd;
      if (maybeRd === undefined) return true; // rd is optional
      if (typeof maybeRd !== "object" || maybeRd === null) return false;

      const maybeModels = (maybeRd as { models?: unknown }).models;
      return maybeModels === undefined || Array.isArray(maybeModels);
    }

    if (isParsedDescription(parsedRaw)) {
      models = parsedRaw.rd?.models ?? [];
      fusion = parsedRaw.rd?.fusion;
      fakecatcher = parsedRaw.rd?.fakecatcher ?? null;
      realityDefender = parsedRaw.rd?.realityDefender ?? null;
    }
  } catch {
    console.warn("PDF Utils: Failed to parse RD description");
  }

  return {
    fileName: resultData.fileName,
    scanId: resultData.scanId,
    fileType: resultData.fileType,
    status: resultData.status,
    confidenceScore: resultData.confidenceScore,
    createdAt: resultData.createdAt,
    imageUrl: resultData.imageUrl,
    fusion,
    fakecatcher,
    realityDefender,
    models: models.map((m) => ({
      name: m.name ?? "Unknown Model",
      status: m.status ?? "UNKNOWN",
      score: typeof m.score === "number" ? m.score : 0,
    })),
  };
}

// Model Map for PDF generation
export const modelMap: Record<string, { label: string; description: string }> = {
  "fakecatcher-rppg": {
    label: "FakeCatcher rPPG",
    description: "Analyzes subtle physiological facial signals in video to detect synthetic manipulation.",
  },
  "rd-img-ensemble": {
    label: "Facial Analysis",
    description:
      "Combines the fakeness scores from all face-based models into a single, more accurate fakeness score.",
  },
  "rd-oak-img": {
    label: "Faceswaps",
    description: "Detects faces manipulated using faceswap methods.",
  },
  "rd-elm-img": {
    label: "Diffusion",
    description: "Detects fake images created using diffusion methods.",
  },
  "rd-cedar-img": {
    label: "GANs",
    description: "Detects images manipulated or generated using Generative Adversarial Networks.",
  },
  "rd-pine-img": {
    label: "Visual Noise Analysis",
    description: "Detects fake images by analyzing texture and noise patterns.",
  },
  "rd-context-img": {
    label: "Context-Aware Results",
    description: "Evaluates the full visual context of the image to detect deepfake manipulation.",
  },
  "rd-context-vid": {
    label: "Video Context Analysis",
    description:
      "Evaluates the temporal and spatial context of video frames to detect synthetic or manipulated content.",
  },
  "rd-elm-vid": {
    label: "Diffusion (Video)",
    description:
      "Detects fake or AI-generated videos created using diffusion-based synthesis methods.",
  },
  "rd-cedar-vid": {
    label: "GANs (Video)",
    description:
      "Detects manipulated or generated videos using GAN-based methods.",
  },
  "rd-pine-vid": {
    label: "Noise & Compression Analysis",
    description:
      "Analyzes temporal noise, artifacts, and compression inconsistencies in videos to detect fakes.",
  },
  "rd-oak-aud": {
    label: "Voice Swap Detection",
    description: "Detects audio segments manipulated using voice cloning or voice swap methods.",
  },
  "rd-cedar-aud": {
    label: "GAN-based Audio Detection",
    description: "Detects fake or manipulated audio generated using adversarial neural networks.",
  },
  "rd-context-aud": {
    label: "Context-Aware Audio",
    description:
      "Analyzes the full acoustic and temporal context of an audio clip to identify deepfake or synthetic speech.",
  },
};

// helper to fetch image -> dataURL (works in browser)
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
} catch (e) {
  console.warn("toDataUrl failed:", e);
  return null;
}
}

export const handleDownloadPDF = async (dto: PdfResultDto) => {
  const result = dto ?? {};
  const doc = new jsPDF("p", "mm", "a4");
  const margin = 20;
  const lineHeight = 8;
  let y = margin + 20;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const infoStartY = margin + 30;
  let infoY = infoStartY;

  // Header / Footer images (will be loaded to data URLs)
  const headerImg = "/logo-dark.jpg";
  const footerImg = "/logo-light.ico";
  const headerHeight = 32;
  const footerHeight = 25;

  // --- Header & Footer ---
  try {
    const headerData = await toDataUrl(headerImg);
    const footerData = await toDataUrl(footerImg);
    if (headerData) doc.addImage(headerData, "PNG", 0, 0, pageWidth, headerHeight);
    if (footerData) doc.addImage(footerData, "PNG", 0, pageHeight - footerHeight, pageWidth, footerHeight);
  } catch (err) {
    console.warn("Header/Footer not loaded:", err);
  }

  // --- Title ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Deeptrack Gotham Media Verification Report", margin, y);
  y += 20;

  // --- File Information ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("File Information", margin, (infoY += 5));
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);

  y += 40;
 
  infoY += 10;
  doc.text(`File Name: ${result.fileMeta?.name || result.fileName || "N/A"}`, margin, infoY);
  doc.text(`Scan ID: ${result.scanId || "N/A"}`, margin, (infoY += lineHeight));
  doc.text(`Type: ${result.fileMeta?.type || result.fileType || "N/A"}`, margin, (infoY += lineHeight));
  doc.text(
    `Size: ${result.fileMeta?.size ? (result.fileMeta.size / 1024).toFixed(2) + " KB" : "N/A"}`,
    margin,
    (infoY += lineHeight)
  );
  doc.text(
    `Uploaded: ${result.uploadedAt || result.createdAt ? new Date(String(result.uploadedAt || result.createdAt)).toLocaleString() : "N/A"}`,
    margin,
    (infoY += lineHeight)
  );

  // --- Overall Result ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Overall Result", margin, (y += 10));
  doc.line(margin, y + 2, 190, y + 2);
  y += 10;

  const status = result.status || "Unknown";
  const score = result.confidenceScore;
  const statusColor: [number, number, number] =
    status === "DEEPFAKE" || status === "MANIPULATED"
      ? [255, 0, 0]
      : status === "SUSPICIOUS"
      ? [220, 140, 0]
      : [0, 128, 0];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Status:", margin, (y += lineHeight));
  doc.setTextColor(...statusColor);
  doc.text(status, margin + 20, y);
  doc.setTextColor(0);

  if (score !== null && score !== undefined) {
    doc.text(
      `Confidence Score: ${(score ).toFixed(1)}%`,
      margin,
      (y += lineHeight)
    );
  }

  doc.setTextColor(0);
  doc.text(`Models Used: ${Array.isArray(result.models) ? result.models.length : 0}`, margin, (y += lineHeight));

  y += 10;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(60);
  const modelCount = Array.isArray(result.models) ? result.models.length : 0;
  const mediaType = result.fileType || "media";
  const summaryText =
    modelCount > 1
      ? `Combines confidence signals from ${modelCount} ${mediaType} models into a single verification confidence score.`
      : `This confidence score is based on the available ${mediaType} model output for this scan.`;
  doc.text(
    summaryText,
    margin,
    (y += 5),
    { maxWidth: 170 }
  );

  y += 15;

  // --- Fusion Summary ---
  if (result.fusion) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Fusion Summary", margin, (y += 8));
    doc.line(margin, y + 2, 190, y + 2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.text(`Final fused status: ${result.fusion.status || "N/A"}`, margin, (y += 8));

    if (typeof result.fusion.score === "number") {
      doc.text(`Final fused confidence: ${(result.fusion.score * 100).toFixed(1)}%`, margin, (y += 6));
    }

    const fakeCatcherWeight = Math.round((result.fusion.weights?.fakecatcher || 0) * 100);
    const realityDefenderWeight = Math.round((result.fusion.weights?.realityDefender || 0) * 100);
    doc.text(`FakeCatcher weight: ${fakeCatcherWeight}%`, margin, (y += 6));
    doc.text(
      `Reality Defender weight: ${realityDefenderWeight}%`,
      margin,
      (y += 6),
      { maxWidth: 170 }
    );

    const fcLabel = result.fakecatcher?.label || "N/A";
    const fcFakeProb = typeof result.fakecatcher?.fake_prob === "number" ? `${(result.fakecatcher.fake_prob * 100).toFixed(1)}%` : "N/A";
    const fcConfidence = typeof result.fakecatcher?.confidence === "number" ? `${result.fakecatcher.confidence.toFixed(1)}%` : "N/A";
    doc.setFont("helvetica", "bold");
    doc.text("FakeCatcher", margin, (y += 8));
    doc.setFont("helvetica", "normal");
    doc.text(`Label: ${fcLabel}`, margin, (y += 6), {
      maxWidth: 170,
    });
    doc.text(`Fake probability: ${fcFakeProb}`, margin, (y += 6), {
      maxWidth: 170,
    });
    doc.text(`Confidence: ${fcConfidence}`, margin, (y += 6), {
      maxWidth: 170,
    });

    const rdStatus = result.realityDefender?.status || "N/A";
    const rdScore = typeof result.realityDefender?.score === "number" ? `${(result.realityDefender.score * 100).toFixed(1)}%` : "N/A";
    doc.setFont("helvetica", "bold");
    doc.text("Reality Defender", margin, (y += 8));
    doc.setFont("helvetica", "normal");
    doc.text(`Status: ${rdStatus}`, margin, (y += 6), {
      maxWidth: 170,
    });
    doc.text(`Score: ${rdScore}`, margin, (y += 6), {
      maxWidth: 170,
    });

    y += 8;
  }

  // --- Detailed Model Breakdown ---
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.text("Detailed Analysis Breakdown", margin, (y += 10));
  doc.line(margin, y + 2, 190, y + 2);

  const modelDetails = Array.isArray(result.models) ? result.models : [];

  if (modelDetails.length > 0) {
    const tableData = modelDetails.map(
      (model: { name: string; status?: string; score?: number }, index: number) => {
        const mapped = modelMap[model.name] || {
          label: model.name,
          description: "No description available.",
        };
        return [
          index + 1,
          mapped.label,
          model.status || "Unknown",
          model.score !== null && model.score !== undefined
            ? `${(model.score * 100).toFixed(1)}%`
            : "N/A",
          mapped.description,
        ];
      }
    );

const tableOptions: UserOptions = {
  startY: y + 8,
  head: [["#", "Model", "Status", "Confidence", "Description"]],
  body: tableData,
  styles: {
    font: "helvetica",
    fontSize: 9,
    cellPadding: 4,
    valign: "middle",
  },
  headStyles: {
    fillColor: [32, 132, 230],
    textColor: [255, 255, 255],
    halign: "center",
  },
  bodyStyles: {
    halign: "center",
    textColor: [30, 30, 30],
  },
  columnStyles: {
    1: { halign: "left", cellWidth: 35 },
    4: { halign: "left", cellWidth: 75 },
  },
  theme: "grid",
};

autoTable(doc, tableOptions);
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("No model data available.", margin, (y += 8));
  }

  // --- Save PDF ---
  const safeName = (result.fileMeta?.name || result.fileName || "report").replace(/[\\/:*?"<>|]/g, "_");
  doc.save(`Gotham-Verification-${safeName}.pdf`);
};
