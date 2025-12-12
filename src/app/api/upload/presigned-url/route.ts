import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";

// Validate required environment variables
function validateEnvVars() {
  const required = [
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_BUCKET_NAME",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

// Initialize S3 client
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    validateEnvVars();
    s3Client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

// Sanitize filename for S3 key (remove special characters, keep alphanumeric, dots, hyphens, underscores)
function sanitizeFileName(fileName: string): string {
  // Remove path separators and other dangerous characters
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_") // Replace multiple underscores with single
    .replace(/^_+|_+$/g, ""); // Remove leading/trailing underscores
}

// Validate file type against allowed MIME types
function validateFileType(
  fileType: string,
  allowedMimeTypes?: string[]
): boolean {
  if (!allowedMimeTypes || allowedMimeTypes.length === 0) {
    return true; // No restrictions
  }
  return allowedMimeTypes.includes(fileType);
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
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

    // Parse request body
    const body = await req.json();
    const { fileName, fileType, fieldId, maxSize, allowedMimeTypes } = body;

    // Validate required fields
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

    // Validate file type if restrictions provided
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

    // Sanitize filename
    const sanitizedFileName = sanitizeFileName(fileName);

    // Generate unique S3 key: business-brain/{userId}/{timestamp}-{filename}
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${sanitizedFileName}`;
    const s3Key = `business-brain/${decoded.userId}/${uniqueFileName}`;

    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: s3Key,
      ContentType: fileType,
    });

    // Generate presigned URL (expires in 5 minutes)
    const client = getS3Client();
    const presignedUrl = await getSignedUrl(client, command, {
      expiresIn: 300, // 5 minutes
    });

    // Construct the final public URL where the file will be accessible
    // Note: This URL format works for most regions. For us-east-1, it would be s3.amazonaws.com
    // The presigned URL will work regardless of region format
    const region = process.env.AWS_REGION;
    const bucketName = process.env.AWS_BUCKET_NAME!;
    const fileUrl = region === "us-east-1"
      ? `https://${bucketName}.s3.amazonaws.com/${s3Key}`
      : `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;

    return NextResponse.json({
      presignedUrl,
      fileUrl,
      key: s3Key,
      fileName: sanitizedFileName,
    });
  } catch (error: any) {
    console.error("Error generating presigned URL:", error);

    // Handle specific AWS errors
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

