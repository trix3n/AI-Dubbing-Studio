import type { Segment } from "./studio";
export type AsrState =
  | "awaiting_upload"
  | "queued"
  | "transcribing"
  | "complete"
  | "failed"
  | "uncertain";
export type AsrJob = {
  id: string;
  name: string;
  size: number;
  contentType: string;
  duration: number;
  sourceKey: string;
  state: AsrState;
  createdAt: string;
  updatedAt: string;
  segments?: Segment[];
  warnings?: string[];
  error?: string;
  requestId?: string;
};
export type PublicAsrJob = Omit<AsrJob, "sourceKey">;
export const PILOT_MAX_SECONDS = 120;
export const FUTURE_MAX_SECONDS = 65 * 60;
export const PILOT_MAX_BYTES = 25 * 1024 * 1024;
export function publicJob(job: AsrJob): PublicAsrJob {
  const { sourceKey: _sourceKey, ...result } = job;
  void _sourceKey;
  // A terminated function must never cause an automatic second charge.
  if (
    ["queued", "transcribing"].includes(result.state) &&
    Date.now() - Date.parse(result.updatedAt) > 6 * 60 * 1000
  ) {
    result.state = "uncertain";
    result.error =
      "Processing was interrupted or timed out. Billing may have occurred. Do not resubmit automatically; check the Deepgram request history.";
  }
  return result;
}
