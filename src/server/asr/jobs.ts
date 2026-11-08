import { ApiError } from "./http";
import { randomUUID } from "node:crypto";
import type { AsrJob } from "@/types/asr";
import {
  PILOT_MAX_BYTES,
  PILOT_MAX_SECONDS,
  FUTURE_MAX_SECONDS,
} from "@/types/asr";
import type { AsrStore } from "./storage";
import { transcribeRussian, ProviderError } from "./deepgram";
export const validId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
export function newJob(input: unknown): AsrJob {
  const v = input as Partial<AsrJob>;
  if (
    !v ||
    !validId(v.id || "") ||
    typeof v.name !== "string" ||
    v.name.length > 180 ||
    !v.name.match(/\.(mp4|mp3|wav|m4a)$/i) ||
    !Number.isInteger(v.size) ||
    v.size! <= 0 ||
    v.size! > PILOT_MAX_BYTES ||
    typeof v.duration !== "number" ||
    !Number.isFinite(v.duration) ||
    v.duration <= 0 ||
    v.duration > FUTURE_MAX_SECONDS ||
    ![
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "video/mp4",
    ].includes(v.contentType || "")
  )
    throw new ApiError(
      "Invalid media. Select MP3, WAV, M4A or MP4 up to 25 MB with a readable duration.",
    );
  if (v.duration > PILOT_MAX_SECONDS)
    throw new ApiError(
      "This pilot accepts up to 2 minutes. Up to 65 minutes requires the future external worker.",
    );
  const now = new Date().toISOString();
  return {
    id: v.id!,
    name: v.name!,
    size: v.size!,
    duration: v.duration,
    contentType: v.contentType!,
    sourceKey: `longray/asr/sources/${v.id}/${randomUUID()}`,
    createdAt: now,
    updatedAt: now,
    state: "awaiting_upload",
  };
}
export async function prepareJob(store: AsrStore, input: unknown) {
  const proposed = newJob(input);
  const existing = await store.read(proposed.id);
  if (existing) {
    if (existing.name !== proposed.name || existing.size !== proposed.size)
      throw new Error("Job ID already belongs to another file.");
    return existing;
  }
  try {
    await store.write(proposed, true);
    return proposed;
  } catch (e) {
    const concurrent = await store.read(proposed.id);
    if (concurrent) return concurrent;
    throw e;
  }
}
export async function startJob(store: AsrStore, id: string) {
  const job = await store.read(id);
  if (!job) throw new Error("Job not found.");
  if (job.state !== "awaiting_upload") return { job, run: false };
  const url = await store.source(job); // Verify object exists before consuming the one-time claim.
  if (!(await store.claim(id))) {
    const current = await store.read(id);
    return {
      job:
        current?.state !== "awaiting_upload" && current
          ? current
          : {
              ...job,
              state: "uncertain" as const,
              error:
                "This job was already claimed. It will not be submitted again. Check stored status and Deepgram request history.",
            },
      run: false,
    };
  }
  const queued = {
    ...job,
    state: "queued" as const,
    updatedAt: new Date().toISOString(),
  };
  await store.write(queued);
  return { job: queued, run: true, url };
}
export async function runJob(
  store: AsrStore,
  job: AsrJob,
  url: string,
  recognize = transcribeRussian,
) {
  try {
    await store.write({
      ...job,
      state: "transcribing",
      updatedAt: new Date().toISOString(),
    });
    const result = await recognize(url, process.env.DEEPGRAM_API_KEY!);
    await store.write({
      ...job,
      state: "complete",
      segments: result.segments,
      warnings: result.warnings,
      requestId: result.requestId,
      duration: result.duration ?? job.duration,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    await store.write({
      ...job,
      state: "failed",
      error:
        error instanceof ProviderError
          ? error.safeMessage
          : "Recognition failed or its result could not be saved. Billing may have occurred; check Deepgram before creating another job.",
      updatedAt: new Date().toISOString(),
    });
  }
}
