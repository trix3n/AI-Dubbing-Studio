import { describe, it, expect, vi, afterEach } from "vitest";
import {
  normalizeDeepgram,
  transcribeRussian,
} from "../src/server/asr/deepgram";
import { newJob, prepareJob, startJob, runJob } from "../src/server/asr/jobs";
import { guardWrite, readJson } from "../src/server/asr/http";
import { publicJob, type AsrJob } from "../src/types/asr";
import type { AsrStore } from "../src/server/asr/storage";
const id = "12345678-1234-4234-9234-123456789abc";
const input = {
  id,
  name: "interview.wav",
  size: 32044,
  duration: 1,
  contentType: "audio/wav",
};
export const fixture = {
  metadata: { request_id: "mock-provider-request", duration: 90 },
  results: {
    utterances: [
      {
        start: 0.75,
        end: 3.2,
        transcript: "Здравствуйте! Расскажите о работе.",
        speaker: 0,
        words: [
          {
            start: 0.75,
            end: 1.4,
            word: "здравствуйте",
            punctuated_word: "Здравствуйте!",
            speaker: 0,
          },
          {
            start: 1.8,
            end: 2.1,
            word: "расскажите",
            punctuated_word: "Расскажите",
            speaker: 0,
          },
          { start: 2.1, end: 2.4, word: "о", speaker: 0 },
          {
            start: 2.4,
            end: 3.2,
            word: "работе",
            punctuated_word: "работе.",
            speaker: 0,
          },
        ],
      },
      { start: 8.2, end: 12, transcript: "Мы начали в 2024 году.", speaker: 1 },
      { start: 12, end: 13, transcript: "Понятно.", speaker: 0 },
    ],
  },
};
function memory() {
  const jobs = new Map<string, AsrJob>();
  const claims = new Set<string>();
  let calls = 0;
  const store: AsrStore = {
    read: async (id) => structuredClone(jobs.get(id) || null),
    write: async (job, only) => {
      if (only && jobs.has(job.id)) throw Error("exists");
      jobs.set(job.id, structuredClone(job));
    },
    claim: async (id) => {
      if (claims.has(id)) return false;
      claims.add(id);
      return true;
    },
    source: async () => {
      calls++;
      return "https://private.example/signed-source";
    },
    upload: async () => "https://private.example/signed-upload",
  };
  return { store, jobs, sourceCalls: () => calls };
}
afterEach(() => vi.unstubAllEnvs());
describe("Deepgram normalization", () => {
  it("preserves Russian Unicode, silence offsets, speaker turns and empty translations", () => {
    const r = normalizeDeepgram(fixture);
    expect(r.segments[0]).toMatchObject({
      start: 0.75,
      end: 1.4,
      original: "Здравствуйте!",
      speaker: "Speaker 1",
      translation: "",
      status: "Draft",
    });
    expect(r.segments[2]).toMatchObject({
      start: 8.2,
      original: "Мы начали в 2024 году.",
      speaker: "Speaker 2",
    });
    expect(r.requestId).toBe("mock-provider-request");
    expect(r.segments).toHaveLength(4);
  });
  it("splits speaker changes within an utterance", () => {
    const r = normalizeDeepgram({
      results: {
        utterances: [
          {
            words: [
              { start: 0, end: 1, word: "Да", speaker: 0 },
              { start: 1, end: 2, word: "Нет", speaker: 1 },
            ],
          },
        ],
      },
    });
    expect(r.segments.map((s) => s.speaker)).toEqual([
      "Speaker 1",
      "Speaker 2",
    ]);
  });
  it("falls back to word timestamps without inventing speaker identity", () => {
    const r = normalizeDeepgram({
      results: {
        channels: [
          { alternatives: [{ words: [{ start: 1, end: 2, word: "Привет" }] }] },
        ],
      },
    });
    expect(r.segments[0].speaker).toBe("Unknown speaker");
    expect(r.warnings[0]).toContain("unavailable");
  });
  it.each([
    {},
    null,
    { results: {} },
    { results: { utterances: [{ start: -1, end: 1, transcript: "x" }] } },
  ])("rejects empty or invalid provider data", (data) =>
    expect(() => normalizeDeepgram(data)).toThrow(),
  );
  it("sends Russian, diarization and utterances only to the fixed provider endpoint", async () => {
    const mock = vi.fn(async () => Response.json(fixture));
    await transcribeRussian(
      "https://private.example/source",
      "test-only-key",
      mock,
    );
    const [url, options] = mock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.hostname).toBe("api.deepgram.com");
    expect(url.searchParams.get("language")).toBe("ru");
    expect(url.searchParams.get("diarize")).toBe("true");
    expect(url.searchParams.get("utterances")).toBe("true");
    expect(options.headers).toMatchObject({
      Authorization: "Token test-only-key",
    });
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it.each([401, 402, 429, 500])(
    "sanitizes %s errors and never retries billable calls",
    async (status) => {
      const mock = vi.fn(
        async () => new Response("sensitive-provider-body", { status }),
      );
      await expect(
        transcribeRussian("https://private.example/source", "test-only", mock),
      ).rejects.not.toThrow("sensitive-provider-body");
      expect(mock).toHaveBeenCalledTimes(1);
    },
  );
});
describe("durable recognition workflow", () => {
  it("validates size, duration and identifiers before creating a pilot job", () => {
    expect(newJob(input).state).toBe("awaiting_upload");
    for (const patch of [
      { duration: 121 },
      { duration: 3901 },
      { size: 30 * 1024 * 1024 },
      { id: "../../x" },
      { size: 0 },
      { duration: NaN },
    ])
      expect(() => newJob({ ...input, ...patch })).toThrow();
  });
  it("completes through a mocked provider, then restores from storage without re-billing", async () => {
    const { store } = memory();
    await prepareJob(store, input);
    const task = await startJob(store, id);
    expect(task.run).toBe(true);
    const recognize = vi.fn(async () => normalizeDeepgram(fixture));
    await runJob(store, task.job, task.url!, recognize);
    const restored = await store.read(id);
    expect(restored?.state).toBe("complete");
    expect(restored?.segments?.[2].original).toBe("Мы начали в 2024 году.");
    expect((await startJob(store, id)).run).toBe(false);
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(publicJob(restored!)).not.toHaveProperty("sourceKey");
  });
  it("uses an atomic claim for concurrent starts", async () => {
    const { store } = memory();
    await prepareJob(store, input);
    const starts = await Promise.all([
      startJob(store, id),
      startJob(store, id),
    ]);
    expect(starts.filter((s) => s.run)).toHaveLength(1);
  });
  it("preserves a failed outcome without automatic retry", async () => {
    const { store } = memory();
    await prepareJob(store, input);
    const task = await startJob(store, id);
    await runJob(store, task.job, task.url!, async () => {
      throw Error("sensitive-key");
    });
    expect((await store.read(id))?.error).not.toContain("sensitive-key");
    expect((await startJob(store, id)).run).toBe(false);
  });
  it("marks stale in-flight jobs uncertain without claiming success", () => {
    expect(
      publicJob({
        ...newJob(input),
        state: "transcribing",
        updatedAt: "2020-01-01T00:00:00Z",
      }).state,
    ).toBe("uncertain");
  });
  it("rejects cross-origin and missing action headers", () => {
    expect(() =>
      guardWrite(
        new Request("https://studio.example/api/asr/jobs", {
          method: "POST",
          headers: {
            origin: "https://evil.example",
            "content-type": "application/json",
            "x-longray-action": "asr",
          },
        }),
      ),
    ).toThrow();
    expect(() =>
      guardWrite(new Request("https://studio.example/api/asr/jobs")),
    ).toThrow();
  });
  it("rejects oversized JSON", async () => {
    await expect(
      readJson(
        new Request("https://studio.example", {
          method: "POST",
          body: "x".repeat(4097),
        }),
      ),
    ).rejects.toThrow("too large");
  });
});

describe("R2 direct upload signing without network requests", () => {
  it("binds type, byte length and immutable creation to the short-lived signed URL", async () => {
    for (const [key, value] of Object.entries({
      DEEPGRAM_API_KEY: "test-only-not-a-real-key",
      R2_ACCOUNT_ID: "0".repeat(32),
      R2_ACCESS_KEY_ID: "test-only-access-id",
      R2_SECRET_ACCESS_KEY: "test-only-not-a-real-secret",
      R2_BUCKET_NAME: "test-only-bucket",
    }))
      vi.stubEnv(key, value);
    const { storage } = await import("../src/server/asr/storage");
    const url = new URL(await storage().upload(newJob(input)));
    const headers = url.searchParams.get("X-Amz-SignedHeaders")!;
    expect(headers).toContain("content-length");
    expect(headers).toContain("content-type");
    expect(headers).toContain("if-none-match");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
  });
});
