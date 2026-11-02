"use client";
import { Play } from "lucide-react";
import type { Voice } from "@/types/studio";
export default function VoicePreview({
  voice,
  notify,
}: {
  voice: Voice;
  notify: (message: string) => void;
}) {
  return (
    <button
      className="preview"
      onClick={() =>
        notify(
          `${voice} · vi-VN · Chirp 3 HD. Audio preview will be available when Google Text-to-Speech is connected.`,
        )
      }
    >
      <Play size={14} /> Preview voice <span>Integration pending</span>
    </button>
  );
}
