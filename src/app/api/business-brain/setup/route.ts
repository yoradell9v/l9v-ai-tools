import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export const runtime = "nodejs";

// Validation function
function validateIntakeData(intakeData: any): { valid: boolean; error?: string } {
    if (!intakeData) {
        return { valid: false, error: "Intake data is required" };
    }

    // Required fields from businessBrainFormConfig
    if (!intakeData.legalName || !intakeData.legalName.trim()) {
        return { valid: false, error: "Legal Business Name is required" };
    }

    if (!intakeData.website || !intakeData.website.trim()) {
        return { valid: false, error: "Website URL is required" };
    }

    if (!intakeData.offers || !intakeData.offers.trim()) {
        return { valid: false, error: "Primary Offers is required" };
    }

    if (!intakeData.outcomePromise || !intakeData.outcomePromise.trim()) {
        return { valid: false, error: "Primary Outcome Promise is required" };
    }

    if (!intakeData.pricing || !intakeData.pricing.trim()) {
        return { valid: false, error: "Pricing Model is required" };
    }

    if (!intakeData.primaryCTA) {
        return { valid: false, error: "Primary CTA is required" };
    }

    if (intakeData.primaryCTA === "custom" && (!intakeData.customCTA || !intakeData.customCTA.trim())) {
        return { valid: false, error: "Custom CTA Text is required when Primary CTA is set to Custom" };
    }

    if (!intakeData.geography || !intakeData.geography.trim()) {
        return { valid: false, error: "Geography Served is required" };
    }

    // Validate ICPs (repeater field - should be an array)
    if (!intakeData.icps || !Array.isArray(intakeData.icps) || intakeData.icps.length === 0) {
        return { valid: false, error: "At least one Ideal Customer Profile (ICP) is required" };
    }

    // Validate each ICP has required fields
    for (let i = 0; i < intakeData.icps.length; i++) {
        const icp = intakeData.icps[i];
        if (!icp.segment || !icp.segment.trim()) {
            return { valid: false, error: `ICP ${i + 1}: Role/Segment is required` };
        }
        if (!icp.pain || !icp.pain.trim()) {
            return { valid: false, error: `ICP ${i + 1}: Primary Pain Point is required` };
        }
        if (!icp.outcome || !icp.outcome.trim()) {
            return { valid: false, error: `ICP ${i + 1}: Desired Outcome is required` };
        }
    }

    if (!intakeData.objections || !intakeData.objections.trim()) {
        return { valid: false, error: "Top 3 Objections is required" };
    }

    if (!intakeData.topCompetitor || !intakeData.topCompetitor.trim()) {
        return { valid: false, error: "#1 Competitor is required" };
    }

    // Validate brand voice sliders
    const sliders = ['formalCasual', 'playfulSerious', 'directStoryDriven', 'punchyDetailed', 'inspirationalAnalytical'];
    for (const slider of sliders) {
        if (intakeData[slider] === undefined || intakeData[slider] === null) {
            return { valid: false, error: `${slider} slider value is required` };
        }
    }

    if (!intakeData.soundsLike || !intakeData.soundsLike.trim()) {
        return { valid: false, error: "Sound Most Like is required" };
    }

    if (!intakeData.hasProofAssets) {
        return { valid: false, error: "Proof Assets question is required" };
    }

    if (intakeData.hasProofAssets === "yes" && (!intakeData.proofAssetsList || !intakeData.proofAssetsList.trim())) {
        return { valid: false, error: "List Your Proof Assets is required when you have proof assets" };
    }

    if (!intakeData.forbiddenWords || !intakeData.forbiddenWords.trim()) {
        return { valid: false, error: "Forbidden Words/Claims is required" };
    }

    if (!intakeData.disclaimers || !intakeData.disclaimers.trim()) {
        return { valid: false, error: "Required Disclaimers is required" };
    }

    if (!intakeData.isRegulated) {
        return { valid: false, error: "Regulated Industry question is required" };
    }

    if (intakeData.isRegulated === "yes" && !intakeData.regulatedIndustryType) {
        return { valid: false, error: "Which Industry is required when Regulated Industry is Yes" };
    }

    return { valid: true };
}

// File upload helper
async function saveFileToPublic(
    file: File,
    fieldName: string,
    brainId: string
): Promise<{ url: string; name: string }> {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create directory structure: public/uploads/business-brain/{brainId}/
    const uploadDir = path.join(process.cwd(), "public", "uploads", "business-brain", brainId);
    
    // Ensure directory exists
    if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${fieldName}_${timestamp}_${originalName}`;
    const filePath = path.join(uploadDir, fileName);

    // Write file
    await writeFile(filePath, buffer);

    // Return public URL path and original filename
    return {
        url: `/uploads/business-brain/${brainId}/${fileName}`,
        name: file.name, // Keep original filename
    };
}

export async function POST(request: Request) {
    try {
        // Get user from session
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

        // Parse multipart form data
        const contentType = request.headers.get("content-type") || "";
        if (!contentType.includes("multipart/form-data")) {
            return NextResponse.json(
                { success: false, error: "Content-Type must be multipart/form-data" },
                { status: 400 }
            );
        }

        const formData = await request.formData();
        const rawIntakeData = formData.get("intake_json");

        if (typeof rawIntakeData !== "string") {
            return NextResponse.json(
                { success: false, error: "Missing intake_json payload." },
                { status: 400 }
            );
        }

        let intakeData: any;
        try {
            intakeData = JSON.parse(rawIntakeData);
        } catch (parseError) {
            return NextResponse.json(
                { success: false, error: "Invalid intake_json payload." },
                { status: 400 }
            );
        }

        // Validate intake data
        const validation = validateIntakeData(intakeData);
        if (!validation.valid) {
            return NextResponse.json(
                { success: false, error: validation.error },
                { status: 400 }
            );
        }

        // Get user's organizations
        const userOrganizations = await prisma.userOrganization.findMany({
            where: {
                userId: decoded.userId,
                organization: {
                    deactivatedAt: null, // Only active organizations
                },
            },
            select: {
                id: true,
                organizationId: true,
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

        // Use the first organization (or could be passed in request)
        const userOrganizationId = userOrganizations[0].id;

        // Get organizationId from request if provided, otherwise use first
        const organizationIdParam = formData.get("organizationId");
        let userOrganizationIdToUse = userOrganizationId;
        
        if (organizationIdParam && typeof organizationIdParam === "string") {
            const userOrg = userOrganizations.find(
                (uo) => uo.organizationId === organizationIdParam
            );
            if (userOrg) {
                userOrganizationIdToUse = userOrg.id;
            }
        }

        // Create BusinessBrain record first to get the ID for file paths
        const businessBrain = await prisma.businessBrain.create({
            data: {
                userOrganizationId: userOrganizationIdToUse,
                intakeData: intakeData as any,
                fileUploads: {} as any,
            } as any,
        });

        // Handle file uploads - store as array of objects with url, name, and type
        const fileUploads: Array<{ url: string; name: string; type: string }> = [];
        const fileFields = ["logo", "brandGuide", "writingSamples", "proofDocuments", "sops", "ghlTemplates"];

        for (const fieldName of fileFields) {
            const file = formData.get(fieldName);
            if (file instanceof File && file.size > 0) {
                try {
                    const fileResult = await saveFileToPublic(file, fieldName, businessBrain.id);
                    fileUploads.push({
                        url: fileResult.url,
                        name: fileResult.name,
                        type: file.type || "application/octet-stream",
                    });
                } catch (fileError) {
                    console.error(`Error saving file ${fieldName}:`, fileError);
                    // Continue with other files even if one fails
                }
            }
        }

        // Update BusinessBrain with file URLs
        const updatedBusinessBrain = await prisma.businessBrain.update({
            where: { id: businessBrain.id },
            data: {
                fileUploads: fileUploads.length > 0 ? (fileUploads as any) : null,
            } as any,
        });

        // Note: Card generation is now handled by the frontend
        // The frontend will call /api/business-brain/generate-cards after receiving the businessBrainId

        return NextResponse.json({
            success: true,
            businessBrainId: updatedBusinessBrain.id,
            businessBrain: updatedBusinessBrain,
        });
    } catch (err: any) {
        console.error("Error setting up business brain:", err);
        return NextResponse.json(
            {
                success: false,
                error: err.message || "Failed to setup business brain.",
            },
            { status: 500 }
        );
    }
}

