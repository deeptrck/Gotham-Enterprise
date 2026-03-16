import mongoose, { Schema, Document } from "mongoose";

export interface IBugReport extends Document {
  userId: string;
  userEmail?: string;
  title: string;
  description: string;
  page?: string;
  priority: "low" | "medium" | "high";
  status: "open" | "resolved";
  createdAt: Date;
  updatedAt: Date;
}

const bugReportSchema = new Schema<IBugReport>(
  {
    userId: { type: String, required: true },
    userEmail: { type: String },
    title: { type: String, required: true },
    description: { type: String, required: true },
    page: { type: String },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
  },
  { timestamps: true }
);

bugReportSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const BugReport =
  mongoose.models?.BugReport || mongoose.model("BugReport", bugReportSchema);
