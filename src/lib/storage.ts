import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

function publicBase(): string {
  // If S3_PUBLIC_URL is explicitly set, use it (strip trailing slash)
  if (process.env.S3_PUBLIC_URL) return process.env.S3_PUBLIC_URL.replace(/\/$/, "")
  // Otherwise derive path-style URL: endpoint/bucket
  const endpoint = (process.env.S3_ENDPOINT || "").replace(/\/$/, "")
  const bucket = process.env.S3_BUCKET_NAME || ""
  return endpoint && bucket ? `${endpoint}/${bucket}` : ""
}

function getClient(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    // Default true for non-AWS providers (Biznet GIO, MinIO, R2 with path-style, etc.)
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  })
}

export function storageEnabled(): boolean {
  return !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_BUCKET_NAME)
}

export async function uploadFile(
  key: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const cmd: ConstructorParameters<typeof PutObjectCommand>[0] = {
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: key,
    Body: data,
    ContentType: contentType,
  }
  // Set per-object public read if provider supports ACL (Biznet GIO, AWS)
  // Skip for providers that don't support ACL (Cloudflare R2) by setting S3_USE_ACL=false
  if (process.env.S3_USE_ACL !== "false") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(cmd as any).ACL = "public-read"
  }
  await getClient().send(new PutObjectCommand(cmd))
  return `${publicBase()}/${key}`
}

export async function deleteFile(key: string): Promise<void> {
  try {
    await getClient().send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
    }))
  } catch (err) {
    console.error("[storage] delete failed:", err instanceof Error ? err.message : err)
  }
}

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
}

export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
