import { test, expect } from "@playwright/test";
function wav() {
  const b = Buffer.alloc(16044);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(16000, 40);
  return b;
}
test("explicit consent, direct upload, async recovery, Russian segments and SRT", async ({
  page,
}) => {
  let starts = 0,
    uploads = 0,
    complete = false;
  let job: Record<string, unknown> = {};
  await page.route("**/api/asr/config", (r) =>
    r.fulfill({ json: { configured: true, enabled: true } }),
  );
  await page.route("**/mock-private-upload", (r) => {
    uploads++;
    return r.fulfill({ status: 200, body: "" });
  });
  await page.route("**/api/asr/jobs", async (r) => {
    const body = r.request().postDataJSON();
    job = { ...body, state: "awaiting_upload" };
    await r.fulfill({
      status: 201,
      json: { job, uploadUrl: "http://127.0.0.1:3000/mock-private-upload" },
    });
  });
  await page.route("**/api/asr/jobs/*/start", async (r) => {
    expect(r.request().postDataJSON().consent).toBe(true);
    starts++;
    job = { ...job, state: "transcribing" };
    await r.fulfill({ status: 202, json: { job } });
  });
  await page.route("**/api/asr/jobs/*", async (r) =>
    r.fulfill({
      json: {
        job: complete
          ? {
              ...job,
              state: "complete",
              segments: [
                {
                  id: "asr-0001",
                  start: 0.5,
                  end: 1,
                  speaker: "Speaker 2",
                  original: "Здравствуйте, мир!",
                  translation: "",
                  voice: "Callirrhoe",
                  status: "Draft",
                },
              ],
              warnings: ["Review speaker labels."],
            }
          : job,
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
  await page
    .getByLabel("Upload media")
    .setInputFiles({
      name: "russian.wav",
      mimeType: "audio/wav",
      buffer: wav(),
    });
  const button = page.getByRole("button", {
    name: "Recognize Russian speech",
    exact: true,
  });
  await expect(button).toBeDisabled();
  expect(starts).toBe(0);
  expect(uploads).toBe(0);
  await page.getByRole("checkbox").check();
  await button.click();
  await expect.poll(() => starts).toBe(1);
  expect(uploads).toBe(1);
  await page.reload();
  await expect(
    page.getByText("Recognition in progress…", { exact: true }),
  ).toBeVisible();
  expect(starts).toBe(1);
  complete = true;
  await expect(
    page.getByText("Здравствуйте, мир!", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel("Vietnamese translation asr-0001")).toHaveValue(
    "",
  );
  await expect(page.locator(".demo-tag")).toHaveText("RUSSIAN TRANSCRIPT");
  await page
    .getByLabel("Vietnamese translation asr-0001")
    .fill("Local edit retained");
  await page.reload();
  await expect(page.getByLabel("Vietnamese translation asr-0001")).toHaveValue(
    "Local edit retained",
  );
  expect(starts).toBe(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "SRT", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("longray-russian.srt");
});
test("missing configuration keeps billable actions disabled", async ({
  page,
}) => {
  await page.route("**/api/asr/config", (r) =>
    r.fulfill({ json: { configured: false, enabled: false } }),
  );
  await page.goto("/");
  await expect(
    page.getByText("Server setup required: Deepgram and private R2 storage."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Recognize Russian speech", exact: true }),
  ).toBeDisabled();
});
test("provider failure and uncertain outcome are visible after refresh", async ({
  page,
}) => {
  const id = "12345678-1234-4234-9234-123456789abc";
  await page.addInitScript(
    (id) => localStorage.setItem("longray-asr-job", id),
    id,
  );
  await page.route("**/api/asr/config", (r) =>
    r.fulfill({ json: { configured: true, enabled: true } }),
  );
  await page.route("**/api/asr/jobs/*", (r) =>
    r.fulfill({
      json: {
        job: {
          id,
          name: "source.wav",
          size: 16044,
          duration: 1,
          state: "uncertain",
          error:
            "Processing interrupted. Billing may have occurred. Check Deepgram before retrying.",
        },
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator('p[role="alert"]')).toContainText(
    "Billing may have occurred",
  );
});
