import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { VerificationResult } from "@/lib/models/VerificationResult";
import { User } from "@/lib/models/User";
import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  keyPrefix: { type: String, required: true },
  keyHash: { type: String, required: true },
  environment: { type: String, enum: ["test", "live"], required: true },
  isActive: { type: Boolean, default: true },
  lastUsed: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const ApiKey = mongoose.models.ApiKey || mongoose.model("ApiKey", apiKeySchema);

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateFilter: Record<string, unknown> = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) (dateFilter.createdAt as Record<string, Date>).$gte = new Date(from);
      if (to) (dateFilter.createdAt as Record<string, Date>).$lte = new Date(to);
    }

    const latencyMatch: Record<string, unknown> = {
      "rdAnalysis.analyzedAt": { $exists: true },
      createdAt: { $exists: true },
    };
    if (from || to) {
      latencyMatch.createdAt = dateFilter.createdAt;
    }

    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 86400000);
    const toDate = to ? new Date(to) : new Date();
    const rangeDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000);
    const dateFormat = rangeDays <= 2 ? "%Y-%m-%d %H:00" : "%Y-%m-%d";

    const [
      totalCalls,
      errorCount,
      activeKeys,
      clientCount,
      latencyResult,
      endpointRaw,
      latencyHistoryRaw,
      dailyVolumeRaw,
    ] = await Promise.all([
      VerificationResult.countDocuments(dateFilter),
      VerificationResult.countDocuments({
        ...dateFilter,
        "rdAnalysis.error": { $exists: true },
      }),
      ApiKey.countDocuments({ isActive: true }),
      User.countDocuments({}),
      VerificationResult.aggregate([
        { $match: latencyMatch },
        {
          $project: {
            latency: {
              $abs: {
                $subtract: [
                  { $toDate: "$rdAnalysis.analyzedAt" },
                  "$createdAt",
                ],
              },
            },
          },
        },
        { $sort: { latency: 1 } },
        {
          $group: {
            _id: null,
            values: { $push: "$latency" },
          },
        },
      ]),
      VerificationResult.aggregate([
        {
          $match: {
            ...dateFilter,
            requestPath: { $exists: true, $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id: { path: "$requestPath", method: "$method" },
            calls: { $sum: 1 },
            errors: {
              $sum: {
                $cond: [
                  { $ifNull: ["$rdAnalysis.error", false] },
                  1,
                  0,
                ],
              },
            },
            latencies: {
              $push: {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ["$rdAnalysis.analyzedAt", false] },
                      { $ifNull: ["$createdAt", false] },
                    ],
                  },
                  {
                    $abs: {
                      $subtract: [
                        { $toDate: "$rdAnalysis.analyzedAt" },
                        "$createdAt",
                      ],
                    },
                  },
                  null,
                ],
              },
            },
          },
        },
        { $sort: { calls: -1 } },
      ]),
      VerificationResult.aggregate([
        { $match: latencyMatch },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
            latencies: {
              $push: {
                $abs: {
                  $subtract: [
                    { $toDate: "$rdAnalysis.analyzedAt" },
                    "$createdAt",
                  ],
                },
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      VerificationResult.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
            calls: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const dailyVolume = dailyVolumeRaw.map((d) => ({
      date: d._id as string,
      calls: d.calls as number,
    }));

    const latencyHistory = latencyHistoryRaw.map((bucket) => {
      const vals = (bucket.latencies as number[]).sort((a, b) => a - b);
      const len = vals.length;
      return {
        date: bucket._id as string,
        p50: len ? Math.round(vals[Math.floor(len * 0.5)]) : 0,
        p95: len ? Math.round(vals[Math.floor(len * 0.95)]) : 0,
        p99: len ? Math.round(vals[Math.floor(len * 0.99)]) : 0,
      };
    });

    let p50 = 0, p95 = 0, p99 = 0;
    if (latencyResult.length > 0) {
      const values = latencyResult[0].values as number[];
      const len = values.length;
      if (len > 0) {
        p50 = values[Math.floor(len * 0.5)];
        p95 = values[Math.floor(len * 0.95)];
        p99 = values[Math.floor(len * 0.99)];
      }
    }

    const totalEpCalls = endpointRaw.reduce((s, ep) => s + (ep.calls as number), 0);

    const endpoints = endpointRaw.map((ep) => {
      const latencies = (ep.latencies as (number | null)[])
        .filter((l): l is number => l !== null)
        .sort((a, b) => a - b);
      const len = latencies.length;
      const p95ms = len > 0 ? latencies[Math.floor(len * 0.95)] : 0;
      const calls = ep.calls as number;
      const errors = ep.errors as number;
      return {
        endpoint: `${(ep._id as { method: string; path: string }).method} ${(ep._id as { method: string; path: string }).path}`,
        calls,
        errors,
        errPct: calls > 0 ? +((errors / calls) * 100).toFixed(2) : 0,
        p95ms: Math.round(p95ms),
        pct: totalEpCalls > 0 ? Math.round((calls / totalEpCalls) * 100) : 0,
      };
    });

    return NextResponse.json({
      totalCalls,
      p50Latency: Math.round(p50),
      p95Latency: Math.round(p95),
      p99Latency: Math.round(p99),
      errorCount,
      errorRate: totalCalls > 0 ? errorCount / totalCalls : 0,
      activeKeys,
      clientCount,
      endpoints,
      dailyVolume,
      latencyHistory,
    });
  } catch (error) {
    console.error("Error fetching API usage stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch API usage stats" },
      { status: 500 }
    );
  }
}
