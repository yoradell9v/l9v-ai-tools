import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import OpenAI from "openai";
import {
  analyzeKnowledgeBaseQuality,
  getQualityDataForStorage,
} from "@/lib/ai-quality-analysis";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: "Invalid token." },
        { status: 401 }
      );
    }

    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null,
        },
        deactivatedAt: null,
      },
      select: {
        organizationId: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!userOrg) {
      return NextResponse.json(
        {
          success: false,
          message: "User does not belong to any active organization.",
        },
        { status: 403 }
      );
    }

    const knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
      where: { organizationId: userOrg.organizationId },
      select: {
        id: true,
        organizationId: true,
        // Core Identity Tier 1 Required
        businessName: true,
        website: true,
        industry: true,
        industryOther: true,
        whatYouSell: true,
        // Business Context Tier 1
        monthlyRevenue: true,
        teamSize: true,
        primaryGoal: true,
        biggestBottleNeck: true,
        // Customer and Market Tier 2
        idealCustomer: true,
        topObjection: true,
        coreOffer: true,
        customerJourney: true,
        // Operations and Tools Tier 2
        toolStack: true,
        primaryCRM: true,
        defaultTimeZone: true,
        bookingLink: true,
        supportEmail: true,
        // Brand & Voice (Tier 2)
        brandVoiceStyle: true,
        riskBoldness: true,
        voiceExampleGood: true,
        voiceExamplesAvoid: true,
        contentLinks: true,
        // Compliance Tier 2
        isRegulated: true,
        regulatedIndustry: true,
        forbiddenWords: true,
        disclaimers: true,
        // HR Defaults
        defaultWeeklyHours: true,
        defaultManagementStyle: true,
        defaultEnglishLevel: true,
        // Proof & Credibility
        proofAssets: true,
        proofFiles: true,
        // Additional Context
        pipeLineStages: true,
        emailSignOff: true,
        // Quality analysis data
        aiQualityScore: true,
        aiQualityAnalysis: true,
        aiQualityAnalyzedAt: true,
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Knowledge base not found. Please complete your profile first.",
        },
        { status: 404 }
      );
    }

    const now = new Date();
    const lastAnalyzed = knowledgeBase.aiQualityAnalyzedAt
      ? new Date(knowledgeBase.aiQualityAnalyzedAt)
      : null;

    const hoursSinceAnalysis = lastAnalyzed
      ? (now.getTime() - lastAnalyzed.getTime()) / (1000 * 60 * 60)
      : Infinity;

    if (hoursSinceAnalysis < 24 && knowledgeBase.aiQualityAnalysis) {
      return NextResponse.json({
        success: true,
        qualityAnalysis: knowledgeBase.aiQualityAnalysis,
        cached: true,
        message:
          "Returning cached analysis. Last analyzed less than 24 hours ago.",
      });
    }

    let qualityAnalysis;
    try {
      qualityAnalysis = await analyzeKnowledgeBaseQuality(
        openai,
        knowledgeBase
      );
    } catch (error) {
      console.error("Error running AI quality analysis:", error);
      return NextResponse.json(
        {
          success: false,
          message:
            "Failed to analyze knowledge base quality. Please try again later.",
          error:
            process.env.NODE_ENV === "development"
              ? error instanceof Error
                ? error.message
                : "Unknown error"
              : undefined,
        },
        { status: 500 }
      );
    }

    const qualityData = getQualityDataForStorage(qualityAnalysis);

    await prisma.organizationKnowledgeBase.update({
      where: { id: knowledgeBase.id },
      data: {
        aiQualityScore: qualityAnalysis.overallScore,
        aiQualityAnalysis: qualityData,
        aiQualityAnalyzedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      qualityAnalysis: qualityAnalysis,
      cached: false,
      message: "Quality analysis completed successfully.",
    });
  } catch (error) {
    console.error("Error in analyze-quality endpoint:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error.",
        error:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: "Invalid token." },
        { status: 401 }
      );
    }

    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null,
        },
        deactivatedAt: null,
      },
      select: {
        organizationId: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!userOrg) {
      return NextResponse.json(
        {
          success: false,
          message: "User does not belong to any active organization.",
        },
        { status: 403 }
      );
    }

    const knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
      where: { organizationId: userOrg.organizationId },
      select: {
        aiQualityScore: true,
        aiQualityAnalysis: true,
        aiQualityAnalyzedAt: true,
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json({
        success: true,
        qualityAnalysis: null,
        message: "Knowledge base not found.",
      });
    }

    return NextResponse.json({
      success: true,
      qualityAnalysis: knowledgeBase.aiQualityAnalysis,
      qualityScore: knowledgeBase.aiQualityScore,
      analyzedAt: knowledgeBase.aiQualityAnalyzedAt,
    });
  } catch (error) {
    console.error("Error fetching quality analysis:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error.",
      },
      { status: 500 }
    );
  }
}
