import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/core/prisma";
import { verifyAccessToken } from "@/lib/core/auth";
import {
  analyzeKnowledgeBaseCompletion,
  getCompletionDataForStorage,
} from "@/lib/analysis/completion-analysis";
import {
  extractFromMultiple,
  extractFromContentLinks,
  FileExtractionInput,
  ExtractedFileContent,
  ExtractedWebsiteContent,
} from "@/lib/extraction/extract-content";

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

    const organizationKnowledgeBase =
      await prisma.organizationKnowledgeBase.findUnique({
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
          // Versioning
          version: true,
          lastEditedBy: true,
          lastEditedAt: true,
          contributors: true,
          // Completion data
          completeness: true,
          completenessBreakdown: true,
          // Quality analysis data
          aiQualityScore: true,
          aiQualityAnalysis: true,
          aiQualityAnalyzedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    const contributorsCount =
      organizationKnowledgeBase?.contributors?.length ?? 0;
    const requiredFieldsComplete = organizationKnowledgeBase
      ? checkRequiredFieldsComplete({
          businessName: organizationKnowledgeBase.businessName,
          website: organizationKnowledgeBase.website,
          industry: organizationKnowledgeBase.industry,
          industryOther: organizationKnowledgeBase.industryOther,
          whatYouSell: organizationKnowledgeBase.whatYouSell,
        })
      : false;

    let completionAnalysis = null;
    if (organizationKnowledgeBase) {
      const qualityAnalysis =
        organizationKnowledgeBase.aiQualityAnalysis || null;
      completionAnalysis = analyzeKnowledgeBaseCompletion(
        organizationKnowledgeBase,
        qualityAnalysis
      );

      if (
        !organizationKnowledgeBase.completeness ||
        !organizationKnowledgeBase.completenessBreakdown
      ) {
        const completionData = getCompletionDataForStorage(completionAnalysis);
        await prisma.organizationKnowledgeBase.update({
          where: { id: organizationKnowledgeBase.id },
          data: {
            completeness: completionAnalysis.overallScore,
            completenessBreakdown: completionData,
          },
        });
        organizationKnowledgeBase.completeness =
          completionAnalysis.overallScore;
        organizationKnowledgeBase.completenessBreakdown = completionData;
      }
    }

    let lastEditedByUser = null;

    if (organizationKnowledgeBase?.lastEditedBy) {
      const user = await prisma.user.findUnique({
        where: { id: organizationKnowledgeBase.lastEditedBy },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
        },
      });
      if (user) {
        lastEditedByUser = {
          id: user.id,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
        };
      }
    }

    let documents = [];
    if (organizationKnowledgeBase) {
      try {
        const docs = await (prisma as any).organizationDocument.findMany({
          where: {
            knowledgeBaseId: organizationKnowledgeBase.id,
          },
          orderBy: {
            uploadedAt: "desc",
          },
          select: {
            id: true,
            name: true,
            url: true,
            key: true,
            type: true,
            size: true,
            uploadedAt: true,
            extractionStatus: true,
          },
        });
        documents = docs.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          url: doc.url,
          key: doc.key,
          type: doc.type,
          size: doc.size,
          uploadedAt: doc.uploadedAt.toISOString(),
          extractionStatus: doc.extractionStatus,
        }));
      } catch (error: any) {
        if (error?.code === 'P2021') {
          console.warn("OrganizationDocument table does not exist yet. Please run the migration.");
          documents = [];
        } else {
          console.error("Error fetching documents:", error);
          documents = [];
        }
      }
    }

    return NextResponse.json({
      success: true,
      organizationProfile: organizationKnowledgeBase
        ? {
            ...organizationKnowledgeBase,
            contributorsCount,
            requiredFieldsComplete,
            lastEditedByUser,
          }
        : null,
      completionAnalysis: completionAnalysis,
      qualityAnalysis: organizationKnowledgeBase?.aiQualityAnalysis || null,
      documents: documents,
      organizationId: userOrg.organizationId,
    });
  } catch (error) {
    console.error("Error fetching organization knowledge base:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

function checkRequiredFieldsComplete(profileData: {
  businessName?: string | null;
  website?: string | null;
  industry?: string | null;
  industryOther?: string | null;
  whatYouSell?: string | null;
}): boolean {
  const hasBusinessName = Boolean(
    profileData.businessName && profileData.businessName.trim() !== ""
  );
  const hasWebsite = Boolean(
    profileData.website && profileData.website.trim() !== ""
  );
  const hasIndustry = Boolean(
    profileData.industry && profileData.industry.trim() !== ""
  );
  const hasWhatYouSell = Boolean(
    profileData.whatYouSell && profileData.whatYouSell.trim() !== ""
  );

  const industryOtherRequired = profileData.industry?.toLowerCase() === "other";
  const hasIndustryOther = Boolean(
    !industryOtherRequired ||
      (profileData.industryOther && profileData.industryOther.trim() !== "")
  );

  return (
    hasBusinessName &&
    hasWebsite &&
    hasIndustry &&
    hasWhatYouSell &&
    hasIndustryOther
  );
}

export async function POST(request: Request) {
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

    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error("Error parsing request body:", error);
      return NextResponse.json(
        { success: false, message: "Invalid request body format." },
        { status: 400 }
      );
    }

    const {
      // Core Identity Tier 1 Required
      businessName,
      website,
      industry,
      industryOther,
      whatYouSell,
      // Business Context Tier 1
      monthlyRevenue,
      teamSize,
      primaryGoal,
      biggestBottleNeck,
      // Customer and Market Tier 2
      idealCustomer,
      topObjection,
      coreOffer,
      customerJourney,
      // Operations and Tools Tier 2
      toolStack,
      primaryCRM,
      defaultTimeZone,
      bookingLink,
      supportEmail,
      // Brand & Voice (Tier 2)
      brandVoiceStyle,
      riskBoldness,
      voiceExampleGood,
      voiceExamplesAvoid,
      contentLinks,
      // Compliance Tier 2
      isRegulated,
      regulatedIndustry,
      forbiddenWords,
      disclaimers,
      // HR Defaults
      defaultWeeklyHours,
      defaultManagementStyle,
      defaultEnglishLevel,
      // Proof & Credibility
      proofAssets,
      proofFiles,
      // Additional Context
      pipeLineStages,
      emailSignOff,
    } = body;

    const existingKnowledgeBase =
      await prisma.organizationKnowledgeBase.findUnique({
        where: { organizationId: userOrg.organizationId },
        select: {
          id: true,
          lastEditedBy: true,
          contributors: true,
          businessName: true,
          website: true,
          industry: true,
          industryOther: true,
          whatYouSell: true,
        },
      });

    const processedIndustryOther =
      industry?.toLowerCase() === "other" ? industryOther : null;

    let processedToolStack: string[] = [];
    if (toolStack !== undefined) {
      if (typeof toolStack === "string") {
        processedToolStack = toolStack
          .split(/[,\n]/)
          .map((tool) => tool.trim())
          .filter((tool) => tool.length > 0);
      } else if (Array.isArray(toolStack)) {
        processedToolStack = toolStack;
      }
    }

    let processedIsRegulated: boolean | null = null;
    if (isRegulated !== undefined) {
      if (typeof isRegulated === "string") {
        processedIsRegulated = isRegulated.toLowerCase() === "yes";
      } else {
        processedIsRegulated = isRegulated;
      }
    }

    const profileData: any = {
      lastEditedBy: decoded.userId,
      lastEditedAt: new Date(),
    };

    if (businessName !== undefined) profileData.businessName = businessName;
    if (website !== undefined) profileData.website = website;
    if (industry !== undefined) profileData.industry = industry;
    if (processedIndustryOther !== undefined)
      profileData.industryOther = processedIndustryOther;
    if (whatYouSell !== undefined) profileData.whatYouSell = whatYouSell;

    if (monthlyRevenue !== undefined)
      profileData.monthlyRevenue = monthlyRevenue;
    if (teamSize !== undefined) profileData.teamSize = teamSize;
    if (primaryGoal !== undefined) profileData.primaryGoal = primaryGoal;
    if (biggestBottleNeck !== undefined)
      profileData.biggestBottleNeck = biggestBottleNeck;

    if (idealCustomer !== undefined) profileData.idealCustomer = idealCustomer;
    if (topObjection !== undefined) profileData.topObjection = topObjection;
    if (coreOffer !== undefined) profileData.coreOffer = coreOffer;
    if (customerJourney !== undefined)
      profileData.customerJourney = customerJourney;

    if (toolStack !== undefined) profileData.toolStack = processedToolStack;
    if (primaryCRM !== undefined) profileData.primaryCRM = primaryCRM;
    if (defaultTimeZone !== undefined)
      profileData.defaultTimeZone = defaultTimeZone;
    if (bookingLink !== undefined) profileData.bookingLink = bookingLink;
    if (supportEmail !== undefined) profileData.supportEmail = supportEmail;

    if (brandVoiceStyle !== undefined)
      profileData.brandVoiceStyle = brandVoiceStyle;
    if (riskBoldness !== undefined) profileData.riskBoldness = riskBoldness;
    if (voiceExampleGood !== undefined)
      profileData.voiceExampleGood = voiceExampleGood;
    if (voiceExamplesAvoid !== undefined)
      profileData.voiceExamplesAvoid = voiceExamplesAvoid;

    let processedContentLinks: string | null = null;
    let contentLinksExtracted: ExtractedWebsiteContent[] | null = null;
    if (contentLinks !== undefined) {
      processedContentLinks = contentLinks; 

      if (contentLinks && contentLinks.trim().length > 0) {
        try {
          contentLinksExtracted = await extractFromContentLinks(contentLinks);
          console.log(
            `Extracted content from ${contentLinksExtracted.length} URLs`
          );
        } catch (error) {
          console.error("Error extracting content from content links:", error);
        }
      }
    }

    if (contentLinks !== undefined) {
      profileData.contentLinks = processedContentLinks;
    }

    if (isRegulated !== undefined)
      profileData.isRegulated = processedIsRegulated;
    if (regulatedIndustry !== undefined)
      profileData.regulatedIndustry = regulatedIndustry;
    if (forbiddenWords !== undefined)
      profileData.forbiddenWords = forbiddenWords;
    if (disclaimers !== undefined) profileData.disclaimers = disclaimers;

    if (defaultWeeklyHours !== undefined)
      profileData.defaultWeeklyHours = defaultWeeklyHours;
    if (defaultManagementStyle !== undefined)
      profileData.defaultManagementStyle = defaultManagementStyle;
    if (defaultEnglishLevel !== undefined)
      profileData.defaultEnglishLevel = defaultEnglishLevel;

    if (proofAssets !== undefined) profileData.proofAssets = proofAssets;

    let processedProofFiles: any = null;
    if (proofFiles !== undefined) {
      let proofFilesArray: string[] = [];
      if (Array.isArray(proofFiles)) {
        proofFilesArray = proofFiles;
      } else if (typeof proofFiles === "string") {
        try {
          const parsed = JSON.parse(proofFiles);
          proofFilesArray = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          proofFilesArray = [proofFiles];
        }
      } else {
        proofFilesArray = Array.isArray(proofFiles) ? proofFiles : [];
      }

      if (proofFilesArray.length > 0) {
        try {
          const fileInputs: FileExtractionInput[] = proofFilesArray.map(
            (fileUrl: string) => {
              const urlParts = fileUrl.split("/");
              const fileName = urlParts[urlParts.length - 1] || "unknown-file";

              let s3Key: string | undefined;
              if (fileUrl.includes("amazonaws.com") || fileUrl.includes("s3")) {
                const s3Match = fileUrl.match(/\/[^\/]+\.(pdf|doc|docx|txt)/i);
                if (s3Match) {
                  s3Key = s3Match[0].substring(1);
                }
              }

              return {
                url: fileUrl,
                fileName,
                s3Key,
              };
            }
          );

          const extractionResult = await extractFromMultiple(
            fileInputs,
            [],
            (completed, total, current) => {
              console.log(
                `Extracting proof files: ${completed}/${total} - ${current}`
              );
            }
          );

          processedProofFiles = {
            files: proofFilesArray.map((url: string, index: number) => {
              const fileName = fileInputs[index]?.fileName || "unknown-file";
              const extracted = extractionResult.files[fileName];

              return {
                url,
                fileName,
                extracted: extracted
                  ? {
                      summary: extracted.summary,
                      keyPoints: extracted.keyPoints,
                      importantSections: extracted.importantSections,
                      extractedAt: extracted.metadata.extractedAt,
                      summarizedAt: extracted.metadata.summarizedAt,
                      error: extracted.error,
                    }
                  : null,
              };
            }),
            extractionErrors: extractionResult.errors,
            extractedAt: new Date().toISOString(),
          };
        } catch (error) {
          console.error("Error extracting content from proof files:", error);
          
          processedProofFiles = {
            files: proofFilesArray.map((url: string) => ({
              url,
              extracted: null,
            })),
            extractionError:
              error instanceof Error ? error.message : "Unknown error",
            extractedAt: new Date().toISOString(),
          };
        }
      } else {
        processedProofFiles = proofFiles;
      }

      profileData.proofFiles = processedProofFiles;
    }

    if (pipeLineStages !== undefined)
      profileData.pipeLineStages = pipeLineStages;
    if (emailSignOff !== undefined) profileData.emailSignOff = emailSignOff;

    const mergedData = {
      businessName:
        profileData.businessName ?? existingKnowledgeBase?.businessName ?? null,
      website: profileData.website ?? existingKnowledgeBase?.website ?? null,
      industry: profileData.industry ?? existingKnowledgeBase?.industry ?? null,
      industryOther:
        profileData.industryOther ??
        existingKnowledgeBase?.industryOther ??
        null,
      whatYouSell:
        profileData.whatYouSell ?? existingKnowledgeBase?.whatYouSell ?? null,
    };

    const requiredFieldsComplete = checkRequiredFieldsComplete(mergedData);

    const existingContributors = existingKnowledgeBase?.contributors ?? [];
    const isNewContributor = !existingContributors.includes(decoded.userId);
    const updatedContributors = isNewContributor
      ? [...existingContributors, decoded.userId]
      : existingContributors;

    let aiInsightsData: any = null;
    if (contentLinksExtracted && contentLinksExtracted.length > 0) {
      const urls = contentLinks
        ? contentLinks
            .split(/[,\n]/)
            .map((u: string) => u.trim())
            .filter((u: string) => u)
        : [];
      aiInsightsData = {
        contentLinksExtracted: contentLinksExtracted.map(
          (extracted, index) => ({
            url: urls[index] || "",
            extracted: {
              sections: extracted.sections,
              overallSummary: extracted.overallSummary,
              keyInsights: extracted.keyInsights,
              testimonials: extracted.testimonials,
              metadata: extracted.metadata,
              error: extracted.error,
            },
          })
        ),
        extractedAt: new Date().toISOString(),
      };
    }

    const existingAiInsights = existingKnowledgeBase
      ? (
          await prisma.organizationKnowledgeBase.findUnique({
            where: { id: existingKnowledgeBase.id },
            select: { aiInsights: true },
          })
        )?.aiInsights || null
      : null;


    const { organizationId: _, ...profileDataForCreate } = profileData;

    const updatedKnowledgeBase = await prisma.organizationKnowledgeBase.upsert({
      where: { organizationId: userOrg.organizationId },
      create: {
        ...profileDataForCreate,
        organization: {
          connect: { id: userOrg.organizationId },
        },
        enrichmentVersion: 1, 
        contributors: [decoded.userId],
        aiInsights: aiInsightsData !== null ? aiInsightsData : undefined,
      },
      update: {
        ...profileData,
        contributors: updatedContributors,
        aiInsights: aiInsightsData
          ? {
              ...(existingAiInsights &&
              typeof existingAiInsights === "object" &&
              !Array.isArray(existingAiInsights)
                ? existingAiInsights
                : {}),
              ...aiInsightsData,
            }
          : undefined,
      },
      select: {
        id: true,
        organizationId: true,
       
        businessName: true,
        website: true,
        industry: true,
        industryOther: true,
        whatYouSell: true,
        
        monthlyRevenue: true,
        teamSize: true,
        primaryGoal: true,
        biggestBottleNeck: true,
        
        idealCustomer: true,
        topObjection: true,
        coreOffer: true,
        customerJourney: true,
        
        toolStack: true,
        primaryCRM: true,
        defaultTimeZone: true,
        bookingLink: true,
        supportEmail: true,
        
        brandVoiceStyle: true,
        riskBoldness: true,
        voiceExampleGood: true,
        voiceExamplesAvoid: true,
        contentLinks: true,
        
        isRegulated: true,
        regulatedIndustry: true,
        forbiddenWords: true,
        disclaimers: true,
        
        defaultWeeklyHours: true,
        defaultManagementStyle: true,
        defaultEnglishLevel: true,
        
        proofAssets: true,
        proofFiles: true,
        
        pipeLineStages: true,
        emailSignOff: true,
        
        version: true,
        lastEditedBy: true,
        lastEditedAt: true,
        contributors: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const contributorsCount = updatedKnowledgeBase.contributors?.length ?? 0;

    const existingQualityAnalysis =
      await prisma.organizationKnowledgeBase.findUnique({
        where: { id: updatedKnowledgeBase.id },
        select: { aiQualityAnalysis: true },
      });

    const qualityAnalysis = existingQualityAnalysis?.aiQualityAnalysis || null;
    const completionAnalysis = analyzeKnowledgeBaseCompletion(
      updatedKnowledgeBase,
      qualityAnalysis
    );
    const completionData = getCompletionDataForStorage(completionAnalysis);

    const updatedWithCompletion = await prisma.organizationKnowledgeBase.update(
      {
        where: { id: updatedKnowledgeBase.id },
        data: {
          completeness: completionAnalysis.overallScore,
          completenessBreakdown: completionData,
        },
        select: {
          id: true,
          organizationId: true,
          businessName: true,
          website: true,
          industry: true,
          industryOther: true,
          whatYouSell: true,
          monthlyRevenue: true,
          teamSize: true,
          primaryGoal: true,
          biggestBottleNeck: true,
          idealCustomer: true,
          topObjection: true,
          coreOffer: true,
          customerJourney: true,
          toolStack: true,
          primaryCRM: true,
          defaultTimeZone: true,
          bookingLink: true,
          supportEmail: true,
          brandVoiceStyle: true,
          riskBoldness: true,
          voiceExampleGood: true,
          voiceExamplesAvoid: true,
          contentLinks: true,
          isRegulated: true,
          regulatedIndustry: true,
          forbiddenWords: true,
          disclaimers: true,
          defaultWeeklyHours: true,
          defaultManagementStyle: true,
          defaultEnglishLevel: true,
          proofAssets: true,
          proofFiles: true,
          pipeLineStages: true,
          emailSignOff: true,
          version: true,
          lastEditedBy: true,
          lastEditedAt: true,
          contributors: true,
          completeness: true,
          completenessBreakdown: true,
          createdAt: true,
          updatedAt: true,
        },
      }
    );

    let lastEditedByUser = null;

    if (updatedWithCompletion.lastEditedBy) {
      const user = await prisma.user.findUnique({
        where: { id: updatedWithCompletion.lastEditedBy },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
        },
      });
      if (user) {
        lastEditedByUser = {
          id: user.id,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
        };
      }
    }

    return NextResponse.json({
      success: true,
      organizationProfile: {
        ...updatedWithCompletion,
        contributorsCount,
        requiredFieldsComplete,
        lastEditedByUser,
      },
      completionAnalysis: completionAnalysis, 
      message: existingKnowledgeBase
        ? "Knowledge base updated successfully."
        : "Knowledge base created successfully.",
    });
  } catch (error) {
    console.error("Error updating organization knowledge base:", error);
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
