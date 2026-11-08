import { storage } from "@/server/asr/storage";
import { prepareJob } from "@/server/asr/jobs";
import { guardWrite, readJson, apiError, ApiError } from "@/server/asr/http";
import { publicJob } from "@/types/asr";
export async function POST(request: Request) {
  try {
    guardWrite(request);
    if (process.env.DEEPGRAM_PILOT_ENABLED !== "true")
      throw new ApiError(
        "Real recognition is disabled until the owner approves the paid pilot.",
        403,
      );
    const store = storage();
    const job = await prepareJob(store, await readJson(request));
    return Response.json(
      {
        job: publicJob(job),
        uploadUrl:
          job.state === "awaiting_upload" ? await store.upload(job) : undefined,
      },
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}
