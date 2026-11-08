"use client";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/types/studio";
import type { PublicAsrJob } from "@/types/asr";
const JOB_KEY = "longray-asr-job";
const APPLIED_KEY = "longray-asr-applied";
async function jsonResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
async function post(path: string, body: unknown) {
  return jsonResponse(
    await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Longray-Action": "asr",
      },
      body: JSON.stringify(body),
    }),
  );
}
export default function RecognitionPanel({
  file,
  onComplete,
  onStatus,
}: {
  file: File | null;
  onComplete: (project: Project) => void;
  onStatus: (message: string) => void;
}) {
  const [config, setConfig] = useState<{
    configured: boolean;
    enabled: boolean;
    missing?: string[];
  } | null>(null);
  const [job, setJob] = useState<PublicAsrJob | null>(null);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const complete = useRef(onComplete);
  const status = useRef(onStatus);
  useEffect(() => {
    complete.current = onComplete;
    status.current = onStatus;
  }, [onComplete, onStatus]);
  useEffect(() => {
    let active = true;
    fetch("/api/asr/config")
      .then(jsonResponse)
      .then((c) => {
        if (active) setConfig(c);
      })
      .catch(() => {
        if (active) setError("Recognition configuration could not be loaded.");
      });
    let lastTerminalId: string | null = null;
    async function poll() {
      let id: string | null;
      try {
        id = localStorage.getItem(JOB_KEY);
      } catch {
        if (active)
          setError(
            "Browser storage is unavailable. Recognition requires recovery storage.",
          );
        return;
      }
      if (!id || id === lastTerminalId) return;
      try {
        const data = await jsonResponse(
          await fetch(`/api/asr/jobs/${encodeURIComponent(id)}`, {
            cache: "no-store",
          }),
        );
        if (!active) return;
        const next = data.job as PublicAsrJob;
        setJob(next);
        setError("");
        if (["complete", "failed", "uncertain"].includes(next.state))
          lastTerminalId = id;
        if (next.state === "complete" && next.segments?.length) {
          if (localStorage.getItem(APPLIED_KEY) !== id) {
            const project: Project = {
              id: next.id,
              name: next.name,
              segments: next.segments,
              source: "deepgram",
              duration: next.duration,
            };
            localStorage.setItem("longray-project", JSON.stringify(project));
            complete.current(project);
            localStorage.setItem(APPLIED_KEY, id);
            status.current(
              "Russian transcript restored from private storage. Review automatic speaker labels.",
            );
          }
          setStage("Transcription complete");
        } else if (["queued", "transcribing"].includes(next.state)) {
          setStage(
            next.state === "queued"
              ? "Queued"
              : "Recognizing Russian speech — elapsed time is not a completion percentage",
          );
        } else if (next.state === "awaiting_upload") {
          setStage(
            "Upload or submission incomplete. Reselect the same file to continue. No automatic paid submission was made.",
          );
        } else if (next.error) setError(next.error);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Could not refresh recognition status.",
          );
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const running = job && ["queued", "transcribing"].includes(job.state);
  async function start() {
    if (!file || !consent || busy || running) return;
    setBusy(true);
    setError("");
    try {
      // Read media metadata in the browser; the server never receives media bytes.
      const duration = await new Promise<number>((resolve, reject) => {
        const audio = document.createElement("video");
        const url = URL.createObjectURL(file);
        const cleanup = () => {
          URL.revokeObjectURL(url);
          audio.removeAttribute("src");
          audio.load();
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(
            new Error(
              "Media metadata could not be read. Try a WAV or MP3 file.",
            ),
          );
        }, 10000);
        audio.preload = "metadata";
        audio.onloadedmetadata = () => {
          const seconds = audio.duration;
          clearTimeout(timer);
          cleanup();
          resolve(seconds);
        };
        audio.onerror = () => {
          clearTimeout(timer);
          cleanup();
          reject(
            new Error("This browser cannot read the media. Try MP3 or WAV."),
          );
        };
        audio.src = url;
      });
      if (
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > 120 ||
        file.size > 25 * 1024 * 1024
      )
        throw new Error(
          "The pilot accepts a readable file up to 2 minutes and 25 MB. Long interviews require the future worker.",
        );
      let id = localStorage.getItem(JOB_KEY);
      let resume: PublicAsrJob | undefined;
      if (id) {
        const response = await fetch(`/api/asr/jobs/${encodeURIComponent(id)}`);
        if (!response.ok)
          throw new Error(
            "The previous job cannot be checked. Restore access before starting another paid request.",
          );
        resume = (await jsonResponse(response)).job;
        if (
          resume &&
          ["queued", "transcribing", "uncertain"].includes(resume.state)
        )
          throw new Error(
            "A previous job is pending or has an uncertain billing outcome. Check its status before starting again.",
          );
      }
      if (!resume || resume.state !== "awaiting_upload")
        id = crypto.randomUUID();
      if (
        resume?.state === "awaiting_upload" &&
        (resume.name !== file.name || resume.size !== file.size)
      )
        throw new Error(
          "Reselect the same file to finish the pending upload, or use Forget job before starting another.",
        );
      localStorage.setItem(JOB_KEY, id!); // Must succeed before network requests.
      const types: Record<string, string> = {
        mp3: "audio/mpeg",
        wav: "audio/wav",
        m4a: "audio/mp4",
        mp4: "video/mp4",
      };
      const contentType = types[file.name.split(".").pop()!.toLowerCase()];
      setStage("Preparing private upload");
      const created = await post("/api/asr/jobs", {
        id,
        name: file.name,
        size: file.size,
        duration,
        contentType,
      });
      setJob(created.job);
      if (created.uploadUrl) {
        setStage("Uploading directly to private storage");
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", created.uploadUrl);
          xhr.setRequestHeader("Content-Type", contentType);
          xhr.setRequestHeader("If-None-Match", "*");
          xhr.timeout = 180000;
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable)
              setStage(
                `Uploading to private storage · ${Math.round((e.loaded / e.total) * 100)}%`,
              );
          };
          xhr.onload = () => {
            if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 412)
              resolve();
            else
              reject(
                new Error(
                  "Private upload failed. Check R2 CORS and reselect the same file to continue.",
                ),
              );
          };
          xhr.onerror = () =>
            reject(
              new Error(
                "Upload connection failed. Check R2 CORS; no recognition was submitted.",
              ),
            );
          xhr.ontimeout = () =>
            reject(
              new Error(
                "Upload timed out. Reselect the same file to continue.",
              ),
            );
          xhr.send(file);
        });
      }
      const submitted = await post(`/api/asr/jobs/${id}/start`, {
        consent: true,
      });
      setJob(submitted.job);
      setStage(
        "Recognition submitted. You may refresh this page; the saved job will be checked without submitting again.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recognition could not start.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div aria-label="Russian speech recognition">
      <p className="hint">
        Deepgram · Russian · automatic speaker labels · 2-minute / 25 MB pilot
      </p>
      <label
        className="hint"
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          margin: "12px 0",
        }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />{" "}
        I approve sending this file to private storage and Deepgram and accept
        possible API charges. Existing editor content will be replaced when
        recognition completes.
      </label>
      <button
        className="secondary"
        disabled={
          !file ||
          !consent ||
          busy ||
          Boolean(running) ||
          !config?.configured ||
          !config?.enabled
        }
        onClick={() => void start()}
      >
        {busy
          ? "Preparing recognition…"
          : running
            ? "Recognition in progress…"
            : "Recognize Russian speech"}
      </button>
      <p className="hint" aria-live="polite">
        {!config
          ? "Checking recognition configuration…"
          : !config.configured
            ? config.missing?.length
              ? `Server setup required: ${config.missing.join(", ")}. Configure these in the existing Vercel project and redeploy.`
              : "Server setup required: Deepgram and private R2 storage."
            : !config.enabled
              ? "Real recognition is disabled until the owner approves the paid pilot."
              : stage ||
                "Ready. Recognition starts only after your explicit confirmation."}
      </p>
      {job && (
        <p className="hint">
          Job: {job.id} · {job.state}
        </p>
      )}
      {error && (
        <p role="alert" className="hint">
          {error}
        </p>
      )}
      {(job || error) && !running && (
        <button
          className="apply-voice"
          onClick={() => {
            if (
              !window.confirm(
                "Forget this job in this browser? This does not cancel provider processing or delete private assets. Check possible charges before starting another job.",
              )
            )
              return;
            try {
              localStorage.removeItem(JOB_KEY);
              localStorage.removeItem(APPLIED_KEY);
              setJob(null);
              setError("");
              setStage(
                "Job reference removed. Stored results remain in private storage.",
              );
            } catch {
              setError("Browser storage is unavailable.");
            }
          }}
        >
          Forget job reference
        </button>
      )}
      {job?.warnings?.map((w) => (
        <p className="hint" key={w}>
          {w}
        </p>
      ))}
    </div>
  );
}
