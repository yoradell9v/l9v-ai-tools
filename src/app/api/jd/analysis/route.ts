import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/core/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "userId is required",
        },
        { status: 400 }
      );
    }

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const finalizedParam = searchParams.get("finalized");
    const search = searchParams.get("search");

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      userId,
    };

    if (finalizedParam !== null && finalizedParam !== undefined) {
      where.isFinalized =
        finalizedParam === null ? true : finalizedParam === "true";
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        {
          intakeData: {
            path: ["companyName"],
            string_contains: search,
          },
        },
      ];
    }

    const [analyses, total] = await Promise.all([
      prisma.savedAnalysis.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          isFinalized: true,
          finalizedAt: true,
          createdAt: true,
          updatedAt: true,
          intakeData: true,
          analysis: true,
          _count: {
            select: {
              refinements: true,
            },
          },
        },
      }),
      prisma.savedAnalysis.count({ where }),
    ]);

    // Simply return the data as-is from the database
    const formattedAnalyses = analyses.map((analysis) => ({
      id: analysis.id,
      title: analysis.title,
      isFinalized: analysis.isFinalized,
      finalizedAt: analysis.finalizedAt,
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt,
      refinementCount: analysis._count.refinements,
      intakeData: analysis.intakeData,
      analysis: analysis.analysis, // Keep the original structure
    }));

    return NextResponse.json({
      success: true,
      data: {
        analyses: formattedAnalyses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + analyses.length < total,
        },
      },
    });
  } catch (error) {
    console.error("List analyses error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load analyses",
      },
      { status: 500 }
    );
  }
}
