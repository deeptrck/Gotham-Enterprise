export interface CreateScanInput {
  fileName: string;
  fileType: "image" | "video" | "audio";
  url?: string;
  file?: File;
}

