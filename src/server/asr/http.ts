export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function guardWrite(request: Request) {
  if (request.headers.get("x-longray-action") !== "asr")
    throw new ApiError("Missing action header.", 403);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new ApiError("Cross-origin action denied.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError("JSON required.", 415);
}
export async function readJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Missing request body.");
  let bytes = 0;
  const parts: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 4096) {
      await reader.cancel();
      throw new ApiError("Request body too large.", 413);
    }
    parts.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw new ApiError("Invalid JSON.");
  }
}
export function apiError(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof ApiError
          ? error.message
          : "Recognition service is unavailable. Check the server configuration and private storage; no automatic paid retry was made.",
    },
    { status: error instanceof ApiError ? error.status : 503 },
  );
}
