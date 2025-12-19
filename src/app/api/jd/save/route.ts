import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { createLearningEvents } from "@/lib/learning-events";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Invalid token." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      title,
      intakeData,
      analysis,
      isFinalized,
      finalizedAt,
      organizationId,
      usedKnowledgeBaseVersion,
      knowledgeBaseSnapshot,
      contributedInsights,
    } = body;

    // Debug logging
    console.log('[Save Route] Received KB metadata:', {
      hasVersion: usedKnowledgeBaseVersion !== null && usedKnowledgeBaseVersion !== undefined,
      version: usedKnowledgeBaseVersion,
      hasSnapshot: knowledgeBaseSnapshot !== null && knowledgeBaseSnapshot !== undefined,
      hasInsights: Array.isArray(contributedInsights) && contributedInsights.length > 0,
      organizationId: organizationId,
    });

    if (!title || !intakeData || !analysis) { 
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: title, intakeData, and analysis are required.",
        },
        { status: 400 }
      );
    }

    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            deactivatedAt: true,
          },
        },
      },
    });

    if (userOrganizations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User does not belong to any active organization.",
        },
        { status: 403 }
      );
    }

    let userOrganizationId: string;
    let finalOrganizationId: string;

    if (organizationId) {
      const userOrg = userOrganizations.find(
        (uo) => uo.organizationId === organizationId
      );
      if (!userOrg) {
        return NextResponse.json(
          {
            success: false,
            error: "User does not have access to the specified organization.",
          },
          { status: 403 }
        );
      }
      userOrganizationId = userOrg.id;
      finalOrganizationId = organizationId;
    } else {
      userOrganizationId = userOrganizations[0].id;
      finalOrganizationId = userOrganizations[0].organizationId;
    }

    // Save the analysis with KB metadata
    // usedKnowledgeBaseVersion: The version number from OrganizationKnowledgeBase.version
    // knowledgeBaseSnapshot: Full snapshot of KB state at analysis time (all non-Json fields)
    // contributedInsights: Extracted insights from the analysis (used to create LearningEvents)
    const savedAnalysis = await prisma.savedAnalysis.create({
      data: {
        userOrganizationId,
        organizationId: finalOrganizationId,
        title,
        intakeData,
        analysis,
        usedKnowledgeBaseVersion: usedKnowledgeBaseVersion ?? undefined, // OrganizationKnowledgeBase.version
        knowledgeBaseSnapshot: knowledgeBaseSnapshot ?? undefined, // Snapshot of KB state
        contributedInsights: contributedInsights ?? undefined, // Extracted insights array
        versionNumber: 1, // SavedAnalysis version (not KB version)
      } as any,
    });

    // Log KB metadata that was saved
    if (usedKnowledgeBaseVersion || knowledgeBaseSnapshot || contributedInsights) {
      console.log(`Saved analysis ${savedAnalysis.id} with KB metadata:`, {
        usedKnowledgeBaseVersion,
        hasSnapshot: !!knowledgeBaseSnapshot,
        insightsCount: Array.isArray(contributedInsights) ? contributedInsights.length : 0,
      });
    }

    if (
      contributedInsights &&
      Array.isArray(contributedInsights) &&
      contributedInsights.length > 0
    ) {
      try {
        const knowledgeBase = await prisma.organizationKnowledgeBase.findUnique(
          {
            where: { organizationId: finalOrganizationId },
            select: { id: true },
          }
        );

        if (knowledgeBase) {
          const learningEventsResult = await createLearningEvents({
            knowledgeBaseId: knowledgeBase.id,
            sourceType: "JOB_DESCRIPTION",
            sourceId: savedAnalysis.id,
            insights: contributedInsights,
            triggeredBy: userOrganizationId,
          });

          if (learningEventsResult.success) {
            console.log(
              `Created ${learningEventsResult.eventsCreated} LearningEvents for analysis ${savedAnalysis.id}`
            );
          } else {
            console.warn(
              `Failed to create some LearningEvents:`,
              learningEventsResult.errors
            );
          }
        } else {
          console.warn(
            `Knowledge base not found for organization ${finalOrganizationId}, skipping LearningEvent creation`
          );
        }
      } catch (learningEventError) {
        console.error("Error creating LearningEvents:", learningEventError);
      }
    }

    return NextResponse.json({ success: true, savedAnalysis });
  } catch (err: any) {
    console.error("Error saving analysis", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save analysis." },
      { status: 500 }
    );
  }
}
