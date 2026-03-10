import mongoose, { Schema, Document } from "mongoose";

export interface IVerificationResult extends Document {
  userId: string;
  scanId: string;
  fileName: string;
  fileType: "image" | "video" | "audio";
  status: "AUTHENTIC" | "SUSPICIOUS" | "DEEPFAKE";
  confidenceScore: number;
  modelsUsed: string[];
  uploadedDate: Date;
  imageUrl?: string;
  url?: string;    
  description?: string;
  features?: string[];
  fcAnalysis?: {
    label?: string;
    confidence?: number;
    fake_prob?: number;
    analyzedAt: string;
  };
  rdAnalysis?: {
    requestId?: string;
    status: string;
    score: number;
    models: Array<{
      name: string;
      status: string;
      score: number;
    }>;
    analyzedAt: string;
    error?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const verificationResultSchema = new Schema<IVerificationResult>(
  {
    userId: { type: String, required: true },
    scanId: { type: String, required: true, unique: true },
    fileName: { type: String, required: true },
    fileType: { type: String, enum: ["image", "video", "audio"], required: true },
    status: { type: String, enum: ["PROCESSING","AUTHENTIC", "SUSPICIOUS", "DEEPFAKE"], required: true },
    confidenceScore: { type: Number, required: true, min: 0, max: 100 },
    modelsUsed: [{ type: String }],
    uploadedDate: { type: Date, default: Date.now },
    imageUrl: { type: String },
    url: { type: String },
    description: { type: String },
    features: [{ type: String }],
    fcAnalysis: {
      label: { type: String },
      confidence: { type: Number },
      fake_prob: { type: Number },
      analyzedAt: { type: String },
    },
    rdAnalysis: {
      requestId: { type: String },
      status: { type: String, required: true },
      score: { type: Number, required: true },
      models: [{
        name: { type: String },
        status: { type: String },
        score: { type: Number },
      }],
      analyzedAt: { type: String, required: true },
      error: { type: String },
    },
  },
  { timestamps: true }
);

// Index for faster queries
verificationResultSchema.index({ userId: 1, createdAt: -1 });

export const VerificationResult =
  mongoose.models?.VerificationResult || mongoose.model("VerificationResult", verificationResultSchema);
