import { test, expect } from "@playwright/test";
test("edits, persists, assigns voices, and exports actual subtitles", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dubbing studio" }),
  ).toBeVisible();
  await page
    .getByLabel("Vietnamese translation 01")
    .fill("Xin chào từ LONGRAY");
  await page.getByRole("button", { name: "Save project" }).click();
  await page.reload();
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
  await page.getByLabel("Restore saved project").click();
  await expect(page.getByLabel("Vietnamese translation 01")).toHaveValue(
    "Xin chào từ LONGRAY",
  );
  await page.getByLabel("Voice for segment 01").selectOption("Despina");
  await expect(page.getByLabel("Voice for segment 01")).toHaveValue("Despina");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "SRT", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("longray-vietnamese.srt");
  await page.getByRole("button", { name: "Preview voice" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Audio preview will be available",
  );
  await expect(page.getByRole("button", { name: "WAV Soon" })).toBeDisabled();
});
test("validates upload and navigates dashboard and voice library", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
  await page.getByLabel("Upload media").setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bad"),
  });
  await expect(page.getByRole("status")).toContainText("Choose an MP4");
  await page
    .getByRole("button", { name: "Voice library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Meet your Vietnamese voices" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Use voice" })).toHaveCount(5);
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Recent projects" }),
  ).toBeVisible();
});

test("reviews, filters, applies defaults, and loads local audio", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
  await page
    .getByLabel("Default Vietnamese voice", { exact: true })
    .selectOption("Orus");
  await page.getByRole("button", { name: "Apply to all segments" }).click();
  for (const id of ["01", "02", "03", "04"])
    await expect(page.getByLabel(`Voice for segment ${id}`)).toHaveValue(
      "Orus",
    );
  await page
    .getByRole("button", { name: "Mark reviewed", exact: true })
    .first()
    .click();
  await expect(page.getByText("1 of 4 segments reviewed")).toBeVisible();
  await page.getByLabel("Search transcript").fill("no-such-segment");
  await expect(page.getByText("No matching segments.")).toBeVisible();
  await page.getByLabel("Search transcript").fill("");
  const wav = Buffer.alloc(44 + 16000);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(16000, 40);
  await page
    .getByLabel("Upload media")
    .setInputFiles({ name: "test.wav", mimeType: "audio/wav", buffer: wav });
  await expect(page.getByLabel("Source media player")).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByLabel("Source media player")
        .evaluate((el) => (el as HTMLVideoElement).readyState),
    )
    .toBeGreaterThan(0);
  await expect(page.getByText("Loaded locally", { exact: true })).toBeVisible();
});
