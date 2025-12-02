import { connectToDatabase } from "@/lib/db";
import { VerificationResult } from "@/lib/models/VerificationResult";
import { User } from "@/lib/models/User";
import verifyMedia, { RDModelResult } from "@/lib/realityDefender";
import { verifyMediaBulk, BulkMedia } from "@/lib/verifyMediaBulk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

interface IncomingFile {
  base64?: string;
  url?: string;
  fileType: string;
  fileName: string;
}

// Cache for user scans
const scansCache = new Map<string, { data: any; timestamp: number }>();
const SCANS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// GET: fetch all scans for the signed-in user
export async function GET() {
  const reqId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  console.time(`scans:${reqId}:total`);

  try {
    console.time(`scans:${reqId}:auth`);
    const { userId } = await auth();
    console.timeEnd(`scans:${reqId}:auth`);

    if (!userId) {
      console.timeEnd(`scans:${reqId}:total`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check cache first
    const cacheKey = `scans:${userId}`;
    const cached = scansCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < SCANS_CACHE_TTL) {
      console.timeEnd(`scans:${reqId}:total`);
      return NextResponse.json(cached.data, { status: 200 });
    }

    console.time(`scans:${reqId}:connect`);
    await connectToDatabase();
    console.timeEnd(`scans:${reqId}:connect`);

    // Use compound index for optimal performance
    console.time(`scans:${reqId}:find-scans`);
    const scans = await VerificationResult.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("_id scanId fileName status confidenceScore createdAt fileType imageUrl")
      .lean()
      .maxTimeMS(10000); // 10 second timeout
    
    console.timeEnd(`scans:${reqId}:find-scans`);

    // Cache the results
    scansCache.set(cacheKey, { data: scans, timestamp: Date.now() });

    console.timeEnd(`scans:${reqId}:total`);
    return NextResponse.json(scans, { status: 200 });
  } catch (error) {
    console.error(`Error fetching scans [${reqId}]:`, error);
    try { console.timeEnd(`scans:${reqId}:total`); } catch (e) {}
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: create new scan(s) - optimized batch processing
export async function POST(req: NextRequest) {
  const reqId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  console.time(`scan-create:${reqId}:total`);

  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    await connectToDatabase();

    console.time(`scan-create:${reqId}:find-user`);
    const user = await User.findOne({ clerkId: userId });
    console.timeEnd(`scan-create:${reqId}:find-user`);
    
    if (!user || user.credits <= 0) {
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 }
      );
    }

    // Clear scans cache for this user
    scansCache.delete(`scans:${userId}`);

    // Handle bulk verification
    if (Array.isArray(body.files) && body.files.length > 0) {
      const bulkItems: BulkMedia[] = body.files.map((f: IncomingFile) => ({
        fileBuffer: f.base64
          ? Buffer.from(f.base64.replace(/^data:.+;base64,/, ""), "base64")
          : undefined,
        url: f.url,
        fileType: f.fileType,
        fileName: f.fileName,
      }));

      console.time(`scan-create:${reqId}:bulk-verify`);
      const bulkResults = await verifyMediaBulk(bulkItems, 3);
      console.timeEnd(`scan-create:${reqId}:bulk-verify`);

      const savedResults = [];
      let creditCost = 0;

      console.time(`scan-create:${reqId}:save-results`);
      for (const { media, result } of bulkResults) {
        if (!result) continue;

        const overallScore = typeof result.score === "number" ? result.score : 0;
        const confidenceScore = Math.round(overallScore * 100);

        let mappedStatus: "AUTHENTIC" | "SUSPICIOUS" | "DEEPFAKE" = "SUSPICIOUS";
        if (result.status === "AUTHENTIC") mappedStatus = "AUTHENTIC";
        else if (result.status === "MANIPULATED")
          mappedStatus = overallScore >= 0.5 ? "DEEPFAKE" : "SUSPICIOUS";

        const modelsUsed = Array.isArray(result.models)
          ? result.models.map((m) => m.name)
          : [];

        const vr = new VerificationResult({
          userId,
          scanId: media.fileName || `scan-${Date.now()}-${Math.random()}`,
          fileName: media.fileName || "unknown",
          fileType: media.fileType || "image",
          status: mappedStatus,
          confidenceScore,
          modelsUsed,
          imageUrl: media.url,
          description: JSON.stringify({ rd: result }),
          features:
            result.models?.map(
              (m: RDModelResult) =>
                `${m.name}:${m.status}:${Math.round(m.score * 100)}`
            ) || [],
        });

        await vr.save();
        savedResults.push(vr);
        creditCost += 1;
      }
      console.timeEnd(`scan-create:${reqId}:save-results`);

      // Update user credits in one operation
      user.credits -= creditCost;
      await user.save();

      console.timeEnd(`scan-create:${reqId}:total`);
      return NextResponse.json(savedResults, { status: 201 });
    }

    // Single-file verification
    const mediaUrl = (body.fileUrl || body.imageUrl || body.url) as string | undefined;
    const base64 = body.base64 as string | undefined;

    if (!mediaUrl && !base64) throw new Error("No media provided");

    console.time(`scan-create:${reqId}:single-verify`);
    let rdResult = null;
    if (base64) {
      const buffer = Buffer.from(base64.replace(/^data:.+;base64,/, ""), "base64");
      rdResult = await verifyMedia({ fileBuffer: buffer, fileType: body.fileType });
    } else if (mediaUrl) {
      rdResult = await verifyMedia({ url: mediaUrl, fileType: body.fileType });
    }
    console.timeEnd(`scan-create:${reqId}:single-verify`);
    
    if (!rdResult) {
      return NextResponse.json(
        { error: "Failed to retrieve Reality Defender results" },
        { status: 500 }
      );
    }

    const overallScore = typeof rdResult.score === "number" ? rdResult.score : 0;
    const confidenceScore = Math.round(overallScore * 100);
    let mappedStatus: "AUTHENTIC" | "SUSPICIOUS" | "DEEPFAKE" = "SUSPICIOUS";
    if (rdResult.status === "AUTHENTIC") mappedStatus = "AUTHENTIC";
    else if (rdResult.status === "MANIPULATED") mappedStatus = overallScore >= 0.5 ? "DEEPFAKE" : "SUSPICIOUS";

    const modelsUsed = Array.isArray(rdResult.models) ? rdResult.models.map((m) => m.name) : [];

    console.time(`scan-create:${reqId}:save-single`);
    const result = new VerificationResult({
      userId,
      scanId: body.scanId || `scan-${Date.now()}`,
      fileName: body.fileName || mediaUrl?.split("/").pop() || "unknown",
      fileType: body.fileType || "image",
      status: mappedStatus,
      confidenceScore,
      modelsUsed,
      imageUrl: mediaUrl || `data:${body.fileType};base64,${base64}`, 
      url: body.url || mediaUrl, 
      description: JSON.stringify({ rd: rdResult }),
      features: rdResult.models?.map((m: RDModelResult) => `${m.name}:${m.status}:${Math.round(m.score * 100)}`) || [],
    });

    await result.save();
    user.credits -= 1;
    await user.save();
    console.timeEnd(`scan-create:${reqId}:save-single`);

    console.timeEnd(`scan-create:${reqId}:total`);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating scan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}