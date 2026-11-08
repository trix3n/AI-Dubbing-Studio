import { configured, missingConfiguration } from "@/server/asr/storage";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(
    {
      configured: configured(),
      missing: missingConfiguration(),
      enabled: process.env.DEEPGRAM_PILOT_ENABLED === "true",
      maxSeconds: 120,
      maxBytes: 25 * 1024 * 1024,
      model: "nova-2",
      language: "ru",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
