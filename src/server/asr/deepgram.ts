import type { Segment } from "@/types/studio";

type Word = {
  start: number;
  end: number;
  word: string;
  punctuated_word?: string;
  speaker?: number;
};
type Utterance = {
  start: number;
  end: number;
  transcript: string;
  speaker?: number;
  words?: Word[];
};
type DeepgramResult = {
  metadata?: { request_id?: string; duration?: number };
  results?: {
    utterances?: Utterance[];
    channels?: { alternatives?: { transcript?: string; words?: Word[] }[] }[];
  };
};
function validTime(start: number, end: number) {
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    end > start &&
    end <= 3900.5
  );
}
export function normalizeDeepgram(input: unknown): {
  segments: Segment[];
  warnings: string[];
  requestId?: string;
  duration?: number;
} {
  const data = input as DeepgramResult;
  if (!data || typeof data !== "object" || !data.results)
    throw new Error("Deepgram returned an invalid response.");
  const utterances = data.results.utterances;
  const segments: Segment[] = [];
  const add = (start: number, end: number, text: string, speaker?: number) => {
    if (!validTime(start, end) || typeof text !== "string" || !text.trim())
      throw new Error("Deepgram returned invalid segment timestamps or text.");
    if (speaker !== undefined && (!Number.isInteger(speaker) || speaker < 0))
      throw new Error("Deepgram returned an invalid speaker label.");
    segments.push({
      id: `asr-${String(segments.length + 1).padStart(4, "0")}`,
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
      speaker:
        speaker === undefined ? "Unknown speaker" : `Speaker ${speaker + 1}`,
      original: text.trim(),
      translation: "",
      voice: "Algieba",
      status: "Draft",
    });
  };
  const wordsToSegments = (words: Word[], fallback?: number) => {
    let group: Word[] = [];
    const flush = () => {
      if (group.length) {
        add(
          group[0].start,
          group[group.length - 1].end,
          group.map((w) => w.punctuated_word || w.word).join(" "),
          group[0].speaker ?? fallback,
        );
        group = [];
      }
    };
    for (const word of words) {
      if (!validTime(word.start, word.end) || typeof word.word !== "string")
        throw new Error("Deepgram returned invalid word timing.");
      const prev = group[group.length - 1];
      if (
        prev &&
        ((prev.speaker ?? fallback) !== (word.speaker ?? fallback) ||
          word.start - prev.end > 1.2 ||
          /[.!?]$/.test(prev.punctuated_word || prev.word))
      )
        flush();
      group.push(word);
    }
    flush();
  };
  if (Array.isArray(utterances) && utterances.length) {
    for (const u of utterances) {
      if (Array.isArray(u.words) && u.words.length)
        wordsToSegments(u.words, u.speaker);
      else add(u.start, u.end, u.transcript, u.speaker);
    }
  } else {
    const alternatives = data.results.channels?.[0]?.alternatives;
    const words = alternatives?.[0]?.words;
    if (Array.isArray(words) && words.length) wordsToSegments(words);
    else
      throw new Error(
        "No timestamped Russian speech was returned. Check the audio track and language.",
      );
  }
  if (!segments.length) throw new Error("No speech was detected.");
  segments.sort((a, b) => a.start - b.start);
  const warnings = segments.some((s) => s.speaker === "Unknown speaker")
    ? [
        "Some speaker identities are unavailable. Diarization is an estimate, not a verified identity.",
      ]
    : [
        "Speaker labels are automatic estimates; review them against the original audio.",
      ];
  return {
    segments,
    warnings,
    requestId: data.metadata?.request_id,
    duration: data.metadata?.duration,
  };
}
export class ProviderError extends Error {
  constructor(public readonly safeMessage: string) {
    super(safeMessage);
  }
}
export async function transcribeRussian(
  sourceUrl: string,
  key: string,
  fetcher: typeof fetch = fetch,
) {
  // Nova-2 supports Russian. Do not switch models without validating Russian support.
  const url = new URL("https://api.deepgram.com/v1/listen");
  for (const [name, value] of Object.entries({
    model: "nova-2",
    language: "ru",
    diarize: "true",
    utterances: "true",
    punctuate: "true",
    smart_format: "true",
  }))
    url.searchParams.set(name, value);
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: sourceUrl }),
      signal: AbortSignal.timeout(240000),
      redirect: "error",
    });
  } catch {
    throw new ProviderError(
      "Deepgram connection was interrupted. The request may have been billed. Check request history before submitting again.",
    );
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: "Deepgram could not decode the media. Try a supported audio file.",
      401: "Deepgram authentication failed. Check the server API key.",
      402: "Deepgram billing or account balance does not allow this request.",
      403: "Deepgram access denied. Check project permissions.",
      413: "The media exceeds the provider size limit.",
      429: "Deepgram rate limit reached. No automatic paid retry was made.",
    };
    throw new ProviderError(
      messages[response.status] ||
        "Deepgram returned an error. Check provider request history before retrying; billing may have occurred.",
    );
  }
  try {
    return normalizeDeepgram(await response.json());
  } catch {
    throw new ProviderError(
      "Deepgram response could not be normalized. Check request history; the call may have been billed.",
    );
  }
}
