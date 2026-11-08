import { describe, it, expect, vi, afterEach } from "vitest";
import { GET as configuration } from "../src/app/api/asr/config/route";
import { POST as initialize } from "../src/app/api/asr/jobs/route";
import { POST as start } from "../src/app/api/asr/jobs/[id]/start/route";
import { GET as getJob } from "../src/app/api/asr/jobs/[id]/route";
vi.mock("../src/server/asr/storage", () => ({
  configured: () => true,
  storage: () => ({ read: async () => null }),
}));
afterEach(() => vi.unstubAllEnvs());
const id = "12345678-1234-4234-9234-123456789abc";
const context = { params: Promise.resolve({ id }) };
function request(body: unknown, origin = "https://studio.example") {
  return new Request("https://studio.example/api/asr/jobs/" + id + "/start", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-longray-action": "asr",
    },
    body: JSON.stringify(body),
  });
}
describe("ASR endpoint gates", () => {
  it("exposes readiness, not credentials", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "secret-must-not-leak");
    const response = configuration();
    const text = await response.text();
    expect(text).not.toContain("secret-must-not-leak");
    expect(JSON.parse(text).language).toBe("ru");
  });
  it("keeps paid operations disabled without explicit server enablement", async () => {
    vi.stubEnv("DEEPGRAM_PILOT_ENABLED", "false");
    expect((await initialize(request({}))).status).toBe(403);
    expect((await start(request({ consent: true }), context)).status).toBe(403);
  });
  it("requires per-request consent even when the owner enabled the service", async () => {
    vi.stubEnv("DEEPGRAM_PILOT_ENABLED", "true");
    expect((await start(request({ consent: false }), context)).status).toBe(
      403,
    );
  });
  it("blocks cross-origin write requests", async () => {
    vi.stubEnv("DEEPGRAM_PILOT_ENABLED", "true");
    expect(
      (await start(request({ consent: true }, "https://evil.example"), context))
        .status,
    ).toBe(403);
  });
  it("returns a useful not-found response for missing stored jobs", async () => {
    expect(
      (
        await getJob(
          new Request("https://studio.example/api/asr/jobs/" + id),
          context,
        )
      ).status,
    ).toBe(404);
  });
});
