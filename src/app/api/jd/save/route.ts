import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/core/prisma";
import { verifyAccessToken } from "@/lib/core/auth";
import { createLearningEvents } from "@/lib/learning/learning-events";
import { applyLearningEventsToKB } from "@/lib/learning/apply-learning-events";
import { CONFIDENCE_THRESHOLDS } from "@/lib/knowledge-base/insight-confidence-thresholds";

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

    console.log("[Save Route] Received KB metadata:", {
      hasVersion:
        usedKnowledgeBaseVersion !== null &&
        usedKnowledgeBaseVersion !== undefined,
      version: usedKnowledgeBaseVersion,
      hasSnapshot:
        knowledgeBaseSnapshot !== null && knowledgeBaseSnapshot !== undefined,
      hasInsights:
        Array.isArray(contributedInsights) && contributedInsights.length > 0,
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

    const savedAnalysis = await prisma.savedAnalysis.create({
      data: {
        userOrganizationId,
        organizationId: finalOrganizationId,
        title,
        intakeData,
        analysis,
        usedKnowledgeBaseVersion: usedKnowledgeBaseVersion ?? undefined,
        knowledgeBaseSnapshot: knowledgeBaseSnapshot ?? undefined,
        contributedInsights: contributedInsights ?? undefined,
        versionNumber: 1,
      } as any,
    });

    if (
      usedKnowledgeBaseVersion ||
      knowledgeBaseSnapshot ||
      contributedInsights
    ) {
      console.log(`Saved analysis ${savedAnalysis.id} with KB metadata:`, {
        usedKnowledgeBaseVersion,
        hasSnapshot: !!knowledgeBaseSnapshot,
        insightsCount: Array.isArray(contributedInsights)
          ? contributedInsights.length
          : 0,
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

            try {
              const enrichmentResult = await applyLearningEventsToKB({
                knowledgeBaseId: knowledgeBase.id,
                minConfidence: CONFIDENCE_THRESHOLDS.HIGH,
              });

              if (enrichmentResult.success) {
                console.log(
                  `Applied ${enrichmentResult.eventsApplied} learning events to KB ${knowledgeBase.id}. ` +
                    `Updated fields: ${
                      enrichmentResult.fieldsUpdated.join(", ") || "none"
                    }. ` +
                    `Enrichment version: ${enrichmentResult.enrichmentVersion}`
                );
              } else {
                console.warn(
                  `Failed to apply some learning events:`,
                  enrichmentResult.errors
                );
              }
            } catch (enrichmentError) {
              console.error(
                "Error applying learning events to KB (non-critical):",
                enrichmentError
              );
            }
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
