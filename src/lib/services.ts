import type { Segment, Voice } from "../types/studio";
// Server-side integration contracts only. No providers are instantiated in Task 01.
export interface SpeechRecognition {
  transcribe(mediaKey: string, language: "ru"): Promise<Segment[]>;
}
export interface Translation {
  translate(text: string, source: "ru", target: "vi"): Promise<string>;
}
export interface SpeechSynthesis {
  synthesize(
    text: string,
    voice: Voice,
    language: "vi-VN",
  ): Promise<Uint8Array>;
}
export interface Storage {
  createUpload(
    name: string,
    contentType: string,
  ): Promise<{ url: string; key: string }>;
  signedDownload(key: string): Promise<string>;
}
export type JobStage =
  | "queued"
  | "transcribing"
  | "translating"
  | "synthesizing"
  | "aligning"
  | "exporting"
  | "complete"
  | "failed";
export interface BackgroundWorker {
  enqueue(projectId: string): Promise<string>;
  status(
    jobId: string,
  ): Promise<{ stage: JobStage; progress: number; error?: string }>;
}
