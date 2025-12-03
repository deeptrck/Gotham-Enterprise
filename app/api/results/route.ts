import { connectToDatabase } from "@/lib/db";
import { VerificationResult } from "@/lib/models/VerificationResult";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * GET /api/results - Fetch all scan results for the authenticated user with pagination
 */
export async function GET(req: NextRequest) {
  const reqId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  console.time(`results:${reqId}:total`);

  try {
    console.time(`results:${reqId}:auth`);
    const { userId } = await auth();
    console.timeEnd(`results:${reqId}:auth`);

    if (!userId) {
      console.timeEnd(`results:${reqId}:total`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.time(`results:${reqId}:connect`);
    await connectToDatabase();
    console.timeEnd(`results:${reqId}:connect`);

    // Parse pagination params
    const url = new URL(req.url);
    const pageParam = url.searchParams.get("page");
    const limitParam = url.searchParams.get("limit");

    const page = Math.max(1, Number.isFinite(Number(pageParam)) ? parseInt(pageParam || "1", 10) : 1);
    const limit = Math.max(1, Math.min(100, Number.isFinite(Number(limitParam)) ? parseInt(limitParam || "20", 10) : 20));
    const skip = (page - 1) * limit;

    console.time(`results:${reqId}:queries`);
    const settled = await Promise.allSettled([
      VerificationResult.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("_id scanId fileName status confidenceScore createdAt fileType imageUrl description modelsUsed features")
        .lean(),
      VerificationResult.countDocuments({ userId }),
    ]);
    console.timeEnd(`results:${reqId}:queries`);

    const results = settled[0].status === 'fulfilled' ? settled[0].value : [];
    const total = settled[1].status === 'fulfilled' ? settled[1].value : 0;
    const pages = total > 0 ? Math.ceil(total / limit) : 0;

    console.timeEnd(`results:${reqId}:total`);

    return NextResponse.json(
      {
        success: true,
        data: results,
        pagination: {
          page,
          limit,
          total,
          pages,
          hasNextPage: page < pages,
          hasPrevPage: page > 1,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Error fetching results [${reqId}]:`, error);
    try {
      console.timeEnd(`results:${reqId}:total`);
    } catch (e) {}
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
