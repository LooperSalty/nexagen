import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';

const S3_REGION = process.env.S3_REGION ?? 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET ?? 'nexagen-assets';
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY_ID ?? '';
const S3_SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY ?? '';

const s3Client = new S3Client({
  region: S3_REGION,
  ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT, forcePathStyle: true } : {}),
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
});

export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  if (S3_ENDPOINT) {
    return `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
  }
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

export async function getSignedUrl(
  key: string,
  expiresIn: number = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  return awsGetSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  await s3Client.send(command);
}

export { s3Client, S3_BUCKET };
