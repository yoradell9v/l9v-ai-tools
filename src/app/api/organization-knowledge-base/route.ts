import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { analyzeKnowledgeBaseCompletion, getCompletionDataForStorage } from "@/lib/completion-analysis";
import { 
  extractFromMultiple, 
  extractFromContentLinks,
  FileExtractionInput,
  ExtractedFileContent,
  ExtractedWebsiteContent 
} from "@/lib/extract-content";

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

    // Calculate computed fields for backward compatibility
    const contributorsCount = organizationKnowledgeBase?.contributors?.length ?? 0;
        const requiredFieldsComplete = organizationKnowledgeBase
      ? checkRequiredFieldsComplete({
          businessName: organizationKnowledgeBase.businessName,
          website: organizationKnowledgeBase.website,
          industry: organizationKnowledgeBase.industry,
          industryOther: organizationKnowledgeBase.industryOther,
          whatYouSell: organizationKnowledgeBase.whatYouSell,
        })
      : false;

    // Run completion analysis if knowledge base exists
    // Pass quality analysis if available to enhance tool readiness
    let completionAnalysis = null;
    if (organizationKnowledgeBase) {
      const qualityAnalysis = organizationKnowledgeBase.aiQualityAnalysis || null;
      completionAnalysis = analyzeKnowledgeBaseCompletion(organizationKnowledgeBase, qualityAnalysis);
      
      // Update stored completion data if it's missing or outdated
      if (!organizationKnowledgeBase.completeness || !organizationKnowledgeBase.completenessBreakdown) {
        const completionData = getCompletionDataForStorage(completionAnalysis);
        await prisma.organizationKnowledgeBase.update({
          where: { id: organizationKnowledgeBase.id },
          data: {
            completeness: completionAnalysis.overallScore,
            completenessBreakdown: completionData,
          },
        });
        // Update local object to reflect changes
        organizationKnowledgeBase.completeness = completionAnalysis.overallScore;
        organizationKnowledgeBase.completenessBreakdown = completionData;
      }
    }

    // Fetch user info for lastEditedBy
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

    return NextResponse.json({
      success: true,
      organizationProfile: organizationKnowledgeBase
        ? {
            ...organizationKnowledgeBase,
            // Add computed fields for backward compatibility
            contributorsCount,
            requiredFieldsComplete,
            lastEditedByUser,
          }
        : null,
      completionAnalysis: completionAnalysis, // Include completion analysis in response
      qualityAnalysis: organizationKnowledgeBase?.aiQualityAnalysis || null, // Include quality analysis if available
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

  return hasBusinessName && hasWebsite && hasIndustry && hasWhatYouSell && hasIndustryOther;
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

    // Process toolStack - convert string to array if needed
    let processedToolStack: string[] = [];
    if (toolStack !== undefined) {
      if (typeof toolStack === "string") {
        // Split by comma or newline, trim, and filter empty strings
        processedToolStack = toolStack
          .split(/[,\n]/)
          .map((tool) => tool.trim())
          .filter((tool) => tool.length > 0);
      } else if (Array.isArray(toolStack)) {
        processedToolStack = toolStack;
      }
    }

    // Process isRegulated - convert string to boolean if needed
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

    // Core Identity Tier 1 Required
    if (businessName !== undefined) profileData.businessName = businessName;
    if (website !== undefined) profileData.website = website;
    if (industry !== undefined) profileData.industry = industry;
    if (processedIndustryOther !== undefined)
      profileData.industryOther = processedIndustryOther;
    if (whatYouSell !== undefined) profileData.whatYouSell = whatYouSell;

    // Business Context Tier 1
    if (monthlyRevenue !== undefined)
      profileData.monthlyRevenue = monthlyRevenue;
    if (teamSize !== undefined) profileData.teamSize = teamSize;
    if (primaryGoal !== undefined) profileData.primaryGoal = primaryGoal;
    if (biggestBottleNeck !== undefined)
      profileData.biggestBottleNeck = biggestBottleNeck;

    // Customer and Market Tier 2
    if (idealCustomer !== undefined) profileData.idealCustomer = idealCustomer;
    if (topObjection !== undefined) profileData.topObjection = topObjection;
    if (coreOffer !== undefined) profileData.coreOffer = coreOffer;
    if (customerJourney !== undefined)
      profileData.customerJourney = customerJourney;

    // Operations and Tools Tier 2
    if (toolStack !== undefined) profileData.toolStack = processedToolStack;
    if (primaryCRM !== undefined) profileData.primaryCRM = primaryCRM;
    if (defaultTimeZone !== undefined)
      profileData.defaultTimeZone = defaultTimeZone;
    if (bookingLink !== undefined) profileData.bookingLink = bookingLink;
    if (supportEmail !== undefined) profileData.supportEmail = supportEmail;

    // Brand & Voice (Tier 2)
    if (brandVoiceStyle !== undefined)
      profileData.brandVoiceStyle = brandVoiceStyle;
    if (riskBoldness !== undefined) profileData.riskBoldness = riskBoldness;
    if (voiceExampleGood !== undefined)
      profileData.voiceExampleGood = voiceExampleGood;
    if (voiceExamplesAvoid !== undefined)
      profileData.voiceExamplesAvoid = voiceExamplesAvoid;
    
    // Process contentLinks - extract and summarize content from URLs
    let processedContentLinks: string | null = null;
    let contentLinksExtracted: ExtractedWebsiteContent[] | null = null;
    if (contentLinks !== undefined) {
      processedContentLinks = contentLinks; // Store original URLs
      
      // Extract content from URLs if provided
      if (contentLinks && contentLinks.trim().length > 0) {
        try {
          contentLinksExtracted = await extractFromContentLinks(contentLinks);
          console.log(`Extracted content from ${contentLinksExtracted.length} URLs`);
        } catch (error) {
          console.error("Error extracting content from content links:", error);
          // Continue without extracted content - URLs are still stored
        }
      }
    }
    
    if (contentLinks !== undefined) {
      profileData.contentLinks = processedContentLinks;
    }

    // Compliance Tier 2
    if (isRegulated !== undefined)
      profileData.isRegulated = processedIsRegulated;
    if (regulatedIndustry !== undefined)
      profileData.regulatedIndustry = regulatedIndustry;
    if (forbiddenWords !== undefined)
      profileData.forbiddenWords = forbiddenWords;
    if (disclaimers !== undefined) profileData.disclaimers = disclaimers;

    // HR Defaults
    if (defaultWeeklyHours !== undefined)
      profileData.defaultWeeklyHours = defaultWeeklyHours;
    if (defaultManagementStyle !== undefined)
      profileData.defaultManagementStyle = defaultManagementStyle;
    if (defaultEnglishLevel !== undefined)
      profileData.defaultEnglishLevel = defaultEnglishLevel;

    // Proof & Credibility
    if (proofAssets !== undefined) profileData.proofAssets = proofAssets;
    
    // Process proofFiles - extract and summarize content
    let processedProofFiles: any = null;
    if (proofFiles !== undefined) {
      // Handle proofFiles - can be array of URLs (strings) or JSON object
      let proofFilesArray: string[] = [];
      if (Array.isArray(proofFiles)) {
        proofFilesArray = proofFiles;
      } else if (typeof proofFiles === 'string') {
        // If it's a JSON string, parse it
        try {
          const parsed = JSON.parse(proofFiles);
          proofFilesArray = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          // If parsing fails, treat as single URL string
          proofFilesArray = [proofFiles];
        }
      } else {
        proofFilesArray = Array.isArray(proofFiles) ? proofFiles : [];
      }

      // Extract content from files if any are provided
      if (proofFilesArray.length > 0) {
        try {
          const fileInputs: FileExtractionInput[] = proofFilesArray.map((fileUrl: string) => {
            // Extract filename from URL or use a default
            const urlParts = fileUrl.split('/');
            const fileName = urlParts[urlParts.length - 1] || 'unknown-file';
            
            // Try to extract S3 key if it's an S3 URL
            let s3Key: string | undefined;
            if (fileUrl.includes('amazonaws.com') || fileUrl.includes('s3')) {
              const s3Match = fileUrl.match(/\/[^\/]+\.(pdf|doc|docx|txt)/i);
              if (s3Match) {
                s3Key = s3Match[0].substring(1); // Remove leading slash
              }
            }

            return {
              url: fileUrl,
              fileName,
              s3Key,
            };
          });

          // Extract content from files (with progress callback for logging)
          const extractionResult = await extractFromMultiple(
            fileInputs,
            [],
            (completed, total, current) => {
              console.log(`Extracting proof files: ${completed}/${total} - ${current}`);
            }
          );

          // Structure the result to store both URLs and extracted content
          processedProofFiles = {
            files: proofFilesArray.map((url: string, index: number) => {
              const fileName = fileInputs[index]?.fileName || 'unknown-file';
              const extracted = extractionResult.files[fileName];
              
              return {
                url,
                fileName,
                extracted: extracted ? {
                  summary: extracted.summary,
                  keyPoints: extracted.keyPoints,
                  importantSections: extracted.importantSections,
                  extractedAt: extracted.metadata.extractedAt,
                  summarizedAt: extracted.metadata.summarizedAt,
                  error: extracted.error,
                } : null,
              };
            }),
            extractionErrors: extractionResult.errors,
            extractedAt: new Date().toISOString(),
          };
        } catch (error) {
          console.error("Error extracting content from proof files:", error);
          // Fallback: store URLs without extraction
          processedProofFiles = {
            files: proofFilesArray.map((url: string) => ({
              url,
              extracted: null,
            })),
            extractionError: error instanceof Error ? error.message : "Unknown error",
            extractedAt: new Date().toISOString(),
          };
        }
      } else {
        // No files to process, store as-is
        processedProofFiles = proofFiles;
      }
      
      profileData.proofFiles = processedProofFiles;
    }

    // Additional Context
    if (pipeLineStages !== undefined)
      profileData.pipeLineStages = pipeLineStages;
    if (emailSignOff !== undefined) profileData.emailSignOff = emailSignOff;

    const mergedData = {
      businessName:
        profileData.businessName ?? existingKnowledgeBase?.businessName ?? null,
      website: profileData.website ?? existingKnowledgeBase?.website ?? null,
      industry: profileData.industry ?? existingKnowledgeBase?.industry ?? null,
      industryOther:
        profileData.industryOther ?? existingKnowledgeBase?.industryOther ?? null,
      whatYouSell:
        profileData.whatYouSell ?? existingKnowledgeBase?.whatYouSell ?? null,
    };

    const requiredFieldsComplete = checkRequiredFieldsComplete(mergedData);

    // Update contributors array - add current user if not already present
    const existingContributors = existingKnowledgeBase?.contributors ?? [];
    const isNewContributor = !existingContributors.includes(decoded.userId);
    const updatedContributors = isNewContributor
      ? [...existingContributors, decoded.userId]
      : existingContributors;

    // Prepare aiInsights with extracted content from URLs
    let aiInsightsData: any = null;
    if (contentLinksExtracted && contentLinksExtracted.length > 0) {
      // Store extracted website content in aiInsights
      const urls = contentLinks ? contentLinks.split(/[,\n]/).map((u: string) => u.trim()).filter((u: string) => u) : [];
      aiInsightsData = {
        contentLinksExtracted: contentLinksExtracted.map((extracted, index) => ({
          url: urls[index] || '',
          extracted: {
            sections: extracted.sections,
            overallSummary: extracted.overallSummary,
            keyInsights: extracted.keyInsights,
            testimonials: extracted.testimonials,
            metadata: extracted.metadata,
            error: extracted.error,
          },
        })),
        extractedAt: new Date().toISOString(),
      };
    }

    // Get existing aiInsights to merge
    const existingAiInsights = existingKnowledgeBase 
      ? (await prisma.organizationKnowledgeBase.findUnique({
          where: { id: existingKnowledgeBase.id },
          select: { aiInsights: true },
        }))?.aiInsights || null
      : null;

    // Create a version of profileData without organizationId for create operation
    const { organizationId: _, ...profileDataForCreate } = profileData;
    
    const updatedKnowledgeBase = await prisma.organizationKnowledgeBase.upsert({
      where: { organizationId: userOrg.organizationId },
      create: {
        ...profileDataForCreate,
        organization: {
          connect: { id: userOrg.organizationId }
        },
        enrichmentVersion: 1, // Required field - start at version 1
        contributors: [decoded.userId], // First contributor
        aiInsights: aiInsightsData, // Store extracted content links data
      },
      update: {
        ...profileData,
        contributors: updatedContributors,
        // Merge with existing aiInsights if updating
        aiInsights: aiInsightsData 
          ? { 
              ...(existingAiInsights && typeof existingAiInsights === 'object' && !Array.isArray(existingAiInsights) ? existingAiInsights : {}),
              ...aiInsightsData 
            }
          : undefined,
      },
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
        createdAt: true,
        updatedAt: true,
      },
    });

    // Calculate computed fields for backward compatibility
    const contributorsCount = updatedKnowledgeBase.contributors?.length ?? 0;

    // Get quality analysis if available (before updating with completion)
    const existingQualityAnalysis = await prisma.organizationKnowledgeBase.findUnique({
      where: { id: updatedKnowledgeBase.id },
      select: { aiQualityAnalysis: true },
    });

    // Run completion analysis with quality enhancement if available
    const qualityAnalysis = existingQualityAnalysis?.aiQualityAnalysis || null;
    const completionAnalysis = analyzeKnowledgeBaseCompletion(updatedKnowledgeBase, qualityAnalysis);
    const completionData = getCompletionDataForStorage(completionAnalysis);

    // Update the knowledge base with completion data
    const updatedWithCompletion = await prisma.organizationKnowledgeBase.update({
      where: { id: updatedKnowledgeBase.id },
      data: {
        completeness: completionAnalysis.overallScore,
        completenessBreakdown: completionData,
      },
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
        createdAt: true,
        updatedAt: true,
      },
    });

    // Fetch user info for lastEditedBy
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
        // Add computed fields for backward compatibility
        contributorsCount,
        requiredFieldsComplete,
        lastEditedByUser,
      },
      completionAnalysis: completionAnalysis, // Include full analysis in response
      message: existingKnowledgeBase
        ? "Knowledge base updated successfully."
        : "Knowledge base created successfully.",
    });
  } catch (error) {
    console.error("Error updating organization knowledge base:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });
    return NextResponse.json(
      { 
        success: false, 
        message: "Internal server error.",
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
