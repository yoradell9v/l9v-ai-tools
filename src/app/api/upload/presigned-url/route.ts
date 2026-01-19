import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/core/auth";
import { getUploadPresignedUrl, getFilePublicUrl } from "@/lib/core/s3";

export const runtime = "nodejs";

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_") 
    .replace(/^_+|_+$/g, ""); 
}

function validateFileType(
  fileType: string,
  allowedMimeTypes?: string[]
): boolean {
  if (!allowedMimeTypes || allowedMimeTypes.length === 0) {
    return true;
  }
  return allowedMimeTypes.includes(fileType);
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid token." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { fileName, fileType, fieldId, maxSize, allowedMimeTypes } = body;

    if (!fileName || typeof fileName !== "string") {
      return NextResponse.json(
        { error: "fileName is required and must be a string." },
        { status: 400 }
      );
    }

    if (!fileType || typeof fileType !== "string") {
      return NextResponse.json(
        { error: "fileType is required and must be a string." },
        { status: 400 }
      );
    }

    if (allowedMimeTypes && Array.isArray(allowedMimeTypes)) {
      if (!validateFileType(fileType, allowedMimeTypes)) {
        return NextResponse.json(
          {
            error: `File type ${fileType} is not allowed. Allowed types: ${allowedMimeTypes.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    const sanitizedFileName = sanitizeFileName(fileName);

    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${sanitizedFileName}`;
    const s3Key = `business-brain/${decoded.userId}/${uniqueFileName}`;

    const presignedUrl = await getUploadPresignedUrl(s3Key, fileType, 300);

    const fileUrl = getFilePublicUrl(s3Key);

    return NextResponse.json({
      presignedUrl,
      fileUrl,
      key: s3Key,
      fileName: sanitizedFileName,
    });
  } catch (error: any) {
    console.error("Error generating presigned URL:", error);

    if (error.name === "InvalidAccessKeyId" || error.name === "SignatureDoesNotMatch") {
      return NextResponse.json(
        { error: "AWS credentials are invalid." },
        { status: 500 }
      );
    }

    if (error.name === "NoSuchBucket") {
      return NextResponse.json(
        { error: "S3 bucket does not exist." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate upload URL." },
      { status: 500 }
    );
  }
}