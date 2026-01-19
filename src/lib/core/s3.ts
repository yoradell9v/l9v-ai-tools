import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
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

export async function getDownloadPresignedUrl(s3Key: string, expiresInSeconds: number = 300): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: s3Key,
  });

  return await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });
}

export async function getUploadPresignedUrl(s3Key: string, fileType: string, expiresInSeconds: number = 300): Promise<string> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: s3Key,
    ContentType: fileType,
  });

  return await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });
}

export function getFilePublicUrl(s3Key: string): string {
  const region = process.env.AWS_REGION;
  const bucketName = process.env.AWS_BUCKET_NAME!;
  
  return region === "us-east-1"
    ? `https://${bucketName}.s3.amazonaws.com/${s3Key}`
    : `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;
}
