import { after } from "next/server";
import { storage } from "@/server/asr/storage";
import { startJob, runJob, validId } from "@/server/asr/jobs";
import { publicJob } from "@/types/asr";
import { guardWrite, readJson, ApiError, apiError } from "@/server/asr/http";
export const maxDuration = 300;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    guardWrite(request);
    const body = await readJson(request);
    if (body?.consent !== true || process.env.DEEPGRAM_PILOT_ENABLED !== "true")
      throw new ApiError(
        "Explicit approval of Deepgram charges is required.",
        403,
      );
    const { id } = await params;
    if (!validId(id)) throw new ApiError("Invalid job ID.");
    const store = storage();
    const started = await startJob(store, id);
    if (started.run) after(() => runJob(store, started.job, started.url!));
    return Response.json({ job: publicJob(started.job) }, { status: 202 });
  } catch (e) {
    return apiError(e);
  }
}
