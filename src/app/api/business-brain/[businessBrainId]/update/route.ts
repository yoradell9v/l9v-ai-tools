import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export const runtime = "nodejs";

// File upload helper (for backward compatibility with FormData)
async function saveFileToPublic(
  file: File,
  fieldName: string,
  brainId: string
): Promise<{ url: string; name: string }> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Create directory structure: public/uploads/business-brain/{brainId}/
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "business-brain",
    brainId
  );

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessBrainId: string }> }
) {
  try {
    const { businessBrainId } = await params;

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

    // Verify access to organization
    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null,
        },
      },
      select: {
        id: true,
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

    const userOrganizationIds = userOrganizations.map((uo) => uo.id);

    // Fetch existing business brain
    const existingBrain = await prisma.businessBrain.findFirst({
      where: {
        id: businessBrainId,
        userOrganizationId: { in: userOrganizationIds },
      },
    });

    if (!existingBrain) {
      return NextResponse.json(
        { success: false, error: "Business brain not found or access denied." },
        { status: 404 }
      );
    }

    // Parse existing intakeData
    let existingIntakeData: any = existingBrain.intakeData;
    if (typeof existingIntakeData === "string") {
      try {
        existingIntakeData = JSON.parse(existingIntakeData);
      } catch (e) {
        existingIntakeData = {};
      }
    }

    // Parse existing fileUploads
    let existingFileUploads: any[] = [];
    if (existingBrain.fileUploads) {
      if (typeof existingBrain.fileUploads === "string") {
        try {
          existingFileUploads = JSON.parse(existingBrain.fileUploads);
        } catch (e) {
          existingFileUploads = [];
        }
      } else if (Array.isArray(existingBrain.fileUploads)) {
        existingFileUploads = existingBrain.fileUploads;
      }
    }

    // Detect request format (FormData for backward compatibility or JSON for S3)
    const contentType = request.headers.get("content-type") || "";
    const isFormData = contentType.includes("multipart/form-data");
    const isJson = contentType.includes("application/json");

    let rawIntakeUpdates: string | null = null;
    let formData: FormData | null = null;
    let requestBody: any = null;

    if (isFormData) {
      // Backward compatibility: Handle FormData
      formData = await request.formData();
      rawIntakeUpdates = (formData.get("intake_json") || formData.get("intake_updates")) as string | null;
    } else if (isJson) {
      // New S3 approach: Handle JSON
      try {
        requestBody = await request.json();
        rawIntakeUpdates = requestBody.intake_json || requestBody.intake_updates || null;
      } catch (parseError) {
        console.error("[Update] Failed to parse JSON request body");
        return NextResponse.json(
          { success: false, error: "Invalid JSON request body." },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Content-Type must be multipart/form-data or application/json" },
        { status: 400 }
      );
    }

    // Parse intake updates (partial updates to intakeData)
    let intakeUpdates: any = {};
    if (rawIntakeUpdates && typeof rawIntakeUpdates === "string") {
      try {
        intakeUpdates = JSON.parse(rawIntakeUpdates);
        console.log(`[Update] Parsed ${Object.keys(intakeUpdates).length} intake update fields`);
        
        // Log refinement answers specifically
        const refinementAnswerKeys = Object.keys(intakeUpdates).filter(key => 
          key.includes("_") && !businessBrainFormConfig.sections.flatMap(s => s.fields).some(f => f.id === key)
        );
        if (refinementAnswerKeys.length > 0) {
          console.log(`[Update] Found ${refinementAnswerKeys.length} refinement answers:`, refinementAnswerKeys);
        }
      } catch (e) {
        console.error("[Update] Failed to parse intake updates:", e);
      }
    }

    // Merge existing intakeData with updates
    const updatedIntakeData = {
      ...existingIntakeData,
      ...intakeUpdates,
    };
    
    console.log(`[Update] Merged intake data: ${Object.keys(updatedIntakeData).length} total fields`);

    // Handle file uploads - merge with existing files
    // Support both FormData (backward compatibility) and JSON with S3 URLs (new approach)
    const newFileUploads: Array<{ url: string; name: string; type: string; field?: string; key?: string }> = [...existingFileUploads];
    
    if (isFormData && formData) {
      // Backward compatibility: Process files from FormData
      // Get all file fields from formData (dynamic based on enhancement recommendations)
      const fileFields = new Set<string>();
      for (const [key, value] of formData.entries()) {
        if (value instanceof File && value.size > 0) {
          fileFields.add(key);
        }
      }

      // Also check standard file fields
      const standardFileFields = [
        "brandGuide",
        "styleGuide",
        "proofFiles",
        "proofDocuments",
      ];
      standardFileFields.forEach(field => fileFields.add(field));

      for (const fieldName of fileFields) {
        const file = formData.get(fieldName);
        if (file instanceof File && file.size > 0) {
          try {
            const fileResult = await saveFileToPublic(
              file,
              fieldName,
              businessBrainId
            );
            // Remove any existing files for this field
            const filtered = newFileUploads.filter(
              (f: any) => f?.field !== fieldName
            );
            // Replace array with filtered items
            newFileUploads.splice(0, newFileUploads.length, ...filtered);
            // Add new file
            newFileUploads.push({
              url: fileResult.url,
              name: fileResult.name,
              type: file.type || "application/octet-stream",
              field: fieldName,
            });
          } catch (fileError) {
            console.error(`[Update] Error saving file ${fieldName}:`, fileError);
            // Continue with other files even if one fails
          }
        }
      }
    } else if (isJson && requestBody) {
      // New S3 approach: Process file URLs from JSON
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
          console.error("[Update] Failed to parse file_urls");
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
              `[Update] Invalid file_urls structure for field ${fieldName}`
            );
            return;
          }

          // Remove any existing files for this field
          const filtered = newFileUploads.filter(
            (f: any) => f?.field !== fieldName
          );
          // Replace array with filtered items
          newFileUploads.splice(0, newFileUploads.length, ...filtered);

          // Add new file URLs
          fileUrlArray.forEach((fileUrl) => {
            // Validate file URL metadata
            if (validateFileUrlMetadata(fileUrl)) {
              newFileUploads.push({
                url: fileUrl.url,
                name: fileUrl.name,
                type: fileUrl.type,
                field: fieldName,
                key: fileUrl.key, // Include S3 key for future cleanup
              });
            } else {
              console.warn(
                `[Update] Invalid file URL metadata for field ${fieldName}:`,
                fileUrl
              );
            }
          });
        });
      }
    }

    // Update BusinessBrain
    const updatedBusinessBrain = await prisma.businessBrain.update({
      where: { id: businessBrainId },
      data: {
        intakeData: updatedIntakeData as any,
        fileUploads: newFileUploads.length > 0 ? (newFileUploads as any) : undefined,
      } as any,
    });

    // Invalidate enhancement analysis cache since intake data or files have changed
    try {
      await prisma.enhancementAnalysis.deleteMany({
        where: { brainId: businessBrainId },
      });
      console.log("[Update] Invalidated enhancement analysis cache");
    } catch (error) {
      console.error("[Update] Error invalidating cache:", error);
      // Don't fail the request if cache invalidation fails
    }

    return NextResponse.json({
      success: true,
      businessBrainId: updatedBusinessBrain.id,
      businessBrain: updatedBusinessBrain,
    });
  } catch (err: any) {
    console.error("Error updating business brain:", err);

    let errorMessage = err.message || "Failed to update business brain.";

    if (err.message && err.message.includes("must not be null")) {
      errorMessage =
        "An error occurred while updating your data. Please try again or contact support if the issue persists.";
    }

    if (err.code === "P2002") {
      errorMessage =
        "An error occurred while updating. Please check your details and try again.";
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

