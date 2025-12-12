import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export const runtime = "nodejs";

function validateIntakeData(intakeData: any): {
  valid: boolean;
  error?: string;
} {
  if (!intakeData) {
    return { valid: false, error: "Intake data is required" };
  }

  if (!intakeData.businessName || !intakeData.businessName.trim()) {
    return { valid: false, error: "Business Name is required" };
  }

  if (!intakeData.website || !intakeData.website.trim()) {
    return { valid: false, error: "Website URL is required" };
  }

  if (!intakeData.whatYouSell || !intakeData.whatYouSell.trim()) {
    return { valid: false, error: "What You Sell is required" };
  }

  if (!intakeData.businessType || !intakeData.businessType.trim()) {
    return { valid: false, error: "Business Type is required" };
  }

  if (intakeData.businessType === "other" && (!intakeData.businessTypeOther || !intakeData.businessTypeOther.trim())) {
    return { valid: false, error: "Describe Your Niche is required when Business Type is Other" };
  }

  if (!intakeData.monthlyRevenue || !intakeData.monthlyRevenue.trim()) {
    return { valid: false, error: "Current Monthly Revenue Range is required" };
  }

  if (!intakeData.goal90Day || !intakeData.goal90Day.trim()) {
    return { valid: false, error: "#1 Goal for the Next 90 Days is required" };
  }

  if (!intakeData.biggestBottleneck || !intakeData.biggestBottleneck.trim()) {
    return { valid: false, error: "Biggest Current Bottleneck is required" };
  }

  if (!intakeData.idealCustomer || !intakeData.idealCustomer.trim()) {
    return { valid: false, error: "Ideal Customer Description is required" };
  }

  if (!intakeData.topObjection || !intakeData.topObjection.trim()) {
    return { valid: false, error: "Top Objection You Hear is required" };
  }

  if (!intakeData.coreOffer || !intakeData.coreOffer.trim()) {
    return { valid: false, error: "Core Offer Summary is required" };
  }

  if (!intakeData.customerJourney || !intakeData.customerJourney.trim()) {
    return { valid: false, error: "Simple Customer Journey is required" };
  }

  if (!intakeData.brandVoiceStyle || !intakeData.brandVoiceStyle.trim()) {
    return { valid: false, error: "Brand Voice Style is required" };
  }

  if (!intakeData.riskBoldnessLevel || !intakeData.riskBoldnessLevel.trim()) {
    return { valid: false, error: "Risk / Boldness Level is required" };
  }

  if (!intakeData.primaryCRM || !intakeData.primaryCRM.trim()) {
    return { valid: false, error: "Primary CRM / Platform is required" };
  }

  if (!intakeData.bookingLink || !intakeData.bookingLink.trim()) {
    return { valid: false, error: "Booking Link is required" };
  }

  if (!intakeData.supportEmail || !intakeData.supportEmail.trim()) {
    return { valid: false, error: "Support Email is required" };
  }

  // Optional fields validation (only if provided)
  if (intakeData.isRegulated === "yes" && (!intakeData.regulatedIndustryType || !intakeData.regulatedIndustryType.trim())) {
    return {
      valid: false,
      error: "Which Industry is required when Regulated Industry is Yes",
    };
  }

  if (intakeData.hasProofAssets === "yes" && (!intakeData.proofAssets || !intakeData.proofAssets.trim())) {
    return {
      valid: false,
      error: "Paste 1-2 Examples is required when you have proof assets",
    };
  }

  return { valid: true };
}

// Validate S3 URL format
function isValidS3Url(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Check if it's an S3 URL (s3.amazonaws.com or s3.{region}.amazonaws.com)
    return (
      urlObj.hostname.includes("s3") &&
      urlObj.hostname.includes("amazonaws.com")
    );
  } catch {
    return false;
  }
}

// Validate file URL metadata structure
function validateFileUrlMetadata(
  fileUrl: any
): fileUrl is { url: string; name: string; key: string; type: string } {
  return (
    fileUrl &&
    typeof fileUrl === "object" &&
    typeof fileUrl.url === "string" &&
    typeof fileUrl.name === "string" &&
    typeof fileUrl.key === "string" &&
    typeof fileUrl.type === "string" &&
    fileUrl.url.trim().length > 0 &&
    fileUrl.name.trim().length > 0 &&
    isValidS3Url(fileUrl.url)
  );
}

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

    // Parse JSON request body
    let requestBody: any;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error("[Setup] Failed to parse request body");
      return NextResponse.json(
        { success: false, error: "Invalid request body. Expected JSON." },
        { status: 400 }
      );
    }

    // Extract intake data
    const rawIntakeData = requestBody.intake_json;

    if (!rawIntakeData || typeof rawIntakeData !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing intake_json payload." },
        { status: 400 }
      );
    }

    let intakeData: any;
    try {
      intakeData = JSON.parse(rawIntakeData);
    } catch (parseError) {
      console.error("[Setup] Failed to parse intake_json");
      return NextResponse.json(
        { success: false, error: "Invalid intake_json payload." },
        { status: 400 }
      );
    }

    // Validate intake data - early return before DB access
    const validation = validateIntakeData(intakeData);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Optimized Prisma query - minimal select, limit results
    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null,
        },
      },
      select: {
        id: true,
        organizationId: true,
      },
      take: 10, // Limit results to prevent large queries
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

    // Determine organization to use
    const organizationIdParam = requestBody.organizationId;
    let userOrganizationIdToUse = userOrganizations[0].id;

    if (organizationIdParam && typeof organizationIdParam === "string") {
      const userOrg = userOrganizations.find(
        (uo) => uo.organizationId === organizationIdParam
      );
      if (userOrg) {
        userOrganizationIdToUse = userOrg.id;
      }
    }

    // Create BusinessBrain record - quick DB operation
    const businessBrain = await prisma.businessBrain.create({
      data: {
        userOrganizationId: userOrganizationIdToUse,
        intakeData: intakeData as any,
      } as any,
    });

    // Process file URLs from request body
    const fileUploads: Array<{
      url: string;
      name: string;
      type: string;
      field: string;
      key?: string;
    }> = [];

    const rawFileUrls = requestBody.file_urls;
    if (rawFileUrls) {
      let parsedFileUrls: Record<
        string,
        Array<{ url: string; name: string; key: string; type: string }>
      >;

      try {
        // Parse file_urls JSON string
        parsedFileUrls =
          typeof rawFileUrls === "string"
            ? JSON.parse(rawFileUrls)
            : rawFileUrls;
      } catch (parseError) {
        console.error("[Setup] Failed to parse file_urls");
        return NextResponse.json(
          {
            success: false,
            error: "Invalid file_urls payload format.",
          },
          { status: 400 }
        );
      }

      // Process each field's file URLs
      Object.entries(parsedFileUrls).forEach(([fieldName, fileUrlArray]) => {
        if (!Array.isArray(fileUrlArray)) {
          console.warn(
            `[Setup] Invalid file_urls structure for field ${fieldName}`
          );
          return;
        }

        fileUrlArray.forEach((fileUrl) => {
          // Validate file URL metadata
          if (validateFileUrlMetadata(fileUrl)) {
            fileUploads.push({
              url: fileUrl.url,
              name: fileUrl.name,
              type: fileUrl.type,
              field: fieldName,
              key: fileUrl.key, // Include S3 key for future cleanup
            });
          } else {
            console.warn(
              `[Setup] Invalid file URL metadata for field ${fieldName}:`,
              fileUrl
            );
          }
        });
      });
    }

    const updatedBusinessBrain = await prisma.businessBrain.update({
      where: { id: businessBrain.id },
      data: {
        fileUploads: fileUploads.length > 0 ? (fileUploads as any) : undefined,
      } as any,
    });

    return NextResponse.json({
      success: true,
      businessBrainId: updatedBusinessBrain.id,
      businessBrain: updatedBusinessBrain,
    });
  } catch (err: any) {
    console.error("[Setup] Error:", err.code || err.message);

    let errorMessage = "Failed to setup business brain.";
    let statusCode = 500;

    if (err.code === "P2024") {
      errorMessage =
        "Database connection timeout. Please try again in a moment.";
      statusCode = 503;
    } else if (err.message && err.message.includes("timeout")) {
      errorMessage = "Request timeout. Please try again.";
      statusCode = 504;
    } else if (err.message && err.message.includes("must not be null")) {
      errorMessage =
        "An error occurred while saving your data. Please try again or contact support if the issue persists.";
    } else if (err.code === "P2002") {
      errorMessage =
        "A business profile with this information already exists. Please check your details and try again.";
      statusCode = 409;
    } else if (err.message) {
      errorMessage = err.message;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: statusCode }
    );
  }
}
