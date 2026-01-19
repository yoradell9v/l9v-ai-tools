import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/core/prisma";
import { verifyAccessToken } from "@/lib/core/auth";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
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

    const { documentId } = await params;

    let document;
    try {
      document = await (prisma as any).organizationDocument.findUnique({
        where: { id: documentId },
        include: {
          knowledgeBase: {
            include: {
              organization: {
                include: {
                  users: {
                    where: {
                      userId: decoded.userId,
                      deactivatedAt: null,
                    },
                  },
                },
              },
            },
          },
        },
      });
    } catch (error: any) {
      if (error?.code === "P2021") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Database migration not applied. Please run: npx prisma migrate dev",
          },
          { status: 500 }
        );
      }
      throw error;
    }

    if (!document) {
      return NextResponse.json(
        { success: false, message: "Document not found." },
        { status: 404 }
      );
    }

    if (document.knowledgeBase.organization.users.length === 0) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 403 }
      );
    }

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: document.key,
      ResponseContentType: document.type,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    return NextResponse.json({
      success: true,
      presignedUrl,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("Error generating view URL:", error);
    return NextResponse.json(
      { success: false, message: "Failed to generate view URL." },
      { status: 500 }
    );
  }
}
