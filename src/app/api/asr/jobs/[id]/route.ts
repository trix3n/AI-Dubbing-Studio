import { storage } from "@/server/asr/storage";
import { validId } from "@/server/asr/jobs";
import { publicJob } from "@/types/asr";
import { ApiError, apiError } from "@/server/asr/http";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!validId(id)) throw new ApiError("Invalid job ID.");
    const job = await storage().read(id);
    if (!job) throw new ApiError("Job not found.", 404);
    return Response.json(
      { job: publicJob(job) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
