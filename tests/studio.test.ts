import { describe, it, expect } from "vitest";
import { demoProject, toSrt, validateMedia, timestamp } from "../src/lib/demo";
import { voices } from "../src/types/studio";
describe("subtitle export", () => {
  it("preserves edits, order, and precise SRT timing", () => {
    const segment = {
      ...demoProject.segments[0],
      translation: "Xin chào",
      start: 61.25,
      end: 65.8,
    };
    expect(toSrt([segment])).toBe(
      "1\n00:01:01,250 --> 00:01:05,800\nXin chào\n",
    );
  });
  it("formats editor timestamps", () =>
    expect(timestamp(7.4)).toBe("00:07.400"));
});
describe("local media validation", () => {
  it.each(["movie.mp4", "audio.MP3", "recording.wav", "voice.m4a"])(
    "accepts %s",
    (name) => expect(validateMedia(name, 1024)).toBeNull(),
  );
  it("rejects unsupported, empty, and oversize files", () => {
    expect(validateMedia("x.exe", 1)).toBeTruthy();
    expect(validateMedia("x.mp4", 0)).toBeTruthy();
    expect(validateMedia("x.mp4", 501 * 1024 * 1024)).toBeTruthy();
  });
});
it("uses only the five selected Chirp voices", () => {
  expect(voices.map((v) => v.name)).toEqual([
    "Algieba",
    "Orus",
    "Umbriel",
    "Callirrhoe",
    "Despina",
  ]);
  expect(
    demoProject.segments.every((s) => voices.some((v) => v.name === s.voice)),
  ).toBe(true);
});
