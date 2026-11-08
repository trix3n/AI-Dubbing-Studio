import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AsrJob } from "@/types/asr";
export interface AsrStore {
  read(id: string): Promise<AsrJob | null>;
  write(job: AsrJob, createOnly?: boolean): Promise<void>;
  claim(id: string): Promise<boolean>;
  upload(job: AsrJob): Promise<string>;
  source(job: AsrJob): Promise<string>;
}
export function configured() {
  return [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "DEEPGRAM_API_KEY",
  ].every((k) => Boolean(process.env[k]));
}
export function storage(): AsrStore {
  if (!configured())
    throw new Error(
      "Configure Deepgram and private R2 storage in Vercel before starting recognition.",
    );
  const account = process.env.R2_ACCOUNT_ID!;
  if (!/^[a-f0-9]{32}$/i.test(account))
    throw new Error("R2 account configuration is invalid.");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    maxAttempts: 1,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = process.env.R2_BUCKET_NAME!;
  const key = (id: string) => `longray/asr/jobs/${id}.json`;
  const status = (e: unknown) =>
    (e as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode;
  return {
    async read(id) {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket, Key: key(id) }),
        );
        return JSON.parse(await result.Body!.transformToString()) as AsrJob;
      } catch (e) {
        if (status(e) === 404) return null;
        throw e;
      }
    },
    async write(job, createOnly = false) {
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: key(job.id),
          Body: JSON.stringify(job),
          ContentType: "application/json",
          ...(createOnly ? { IfNoneMatch: "*" } : {}),
        }),
      );
    },
    async claim(id) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket,
            Key: `longray/asr/claims/${id}`,
            Body: "claimed",
            IfNoneMatch: "*",
          }),
        );
        return true;
      } catch (e) {
        if (status(e) === 412 || status(e) === 409) return false;
        throw e;
      }
    },
    async upload(job) {
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket,
          Key: job.sourceKey,
          ContentType: job.contentType,
          ContentLength: job.size,
          IfNoneMatch: "*",
        }),
        {
          expiresIn: 600,
          signableHeaders: new Set([
            "content-type",
            "content-length",
            "if-none-match",
          ]),
        },
      );
    },
    async source(job) {
      const head = await client.send(
        new HeadObjectCommand({ Bucket, Key: job.sourceKey }),
      );
      if (
        head.ContentLength !== job.size ||
        head.ContentType !== job.contentType
      )
        throw new Error(
          "Uploaded object size or type does not match the selected file.",
        );
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket, Key: job.sourceKey }),
        { expiresIn: 600 },
      );
    },
  };
}
