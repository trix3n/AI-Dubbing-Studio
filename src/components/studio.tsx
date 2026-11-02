"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AudioLines,
  LayoutDashboard,
  FolderOpen,
  Settings2,
  ArrowUpRight,
  Plus,
  ChevronRight,
  Upload,
  ArrowRight,
  Play,
  Check,
  Download,
  Headphones,
  SlidersHorizontal,
  FileVideo,
  RotateCcw,
  Search,
  CheckCircle2,
  Mic2,
} from "lucide-react";
import { demoProject, timestamp, toSrt, validateMedia } from "@/lib/demo";
import { voices, type Voice, type Project } from "@/types/studio";
import Badge from "./badge";
import VoicePreview from "./voice-preview";
const subscribe = () => () => {};
export default function Studio() {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [project, setProject] = useState<Project>(structuredClone(demoProject));
  const [view, setView] = useState("Studio");
  const [voice, setVoice] = useState<Voice>("Algieba");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [media, setMedia] = useState<{
    name: string;
    url: string;
    video: boolean;
  } | null>(null);
  const [drag, setDrag] = useState(false);
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const reviewed = project.segments.filter(
    (s) => s.status === "Reviewed",
  ).length;
  function update(id: string, patch: Partial<Project["segments"][number]>) {
    setProject((p) => ({
      ...p,
      segments: p.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
    setSaved(false);
  }
  function upload(file?: File) {
    if (!file) return;
    const error = validateMedia(file.name, file.size);
    if (error) {
      setMessage(error);
      return;
    }
    if (media) URL.revokeObjectURL(media.url);
    setMedia({
      name: file.name,
      url: URL.createObjectURL(file),
      video: /\.mp4$/i.test(file.name),
    });
    setMessage(
      "Media loaded locally. The sample transcript is unchanged; automatic transcription is not connected.",
    );
  }
  function save() {
    try {
      localStorage.setItem("longray-project", JSON.stringify(project));
      setSaved(true);
      setMessage("Project saved in this browser.");
    } catch {
      setMessage(
        "Browser storage is unavailable. Your edits remain in this session.",
      );
    }
  }
  function restore() {
    try {
      const value = localStorage.getItem("longray-project");
      if (!value) {
        setMessage("No saved project in this browser.");
        return;
      }
      const p = JSON.parse(value) as Project;
      if (
        !Array.isArray(p.segments) ||
        p.segments.some(
          (s) =>
            typeof s.translation !== "string" ||
            !voices.some((v) => v.name === s.voice),
        )
      )
        throw Error();
      setProject(p);
      setSaved(true);
      setMessage("Saved project restored.");
    } catch {
      setMessage("Saved project could not be read.");
    }
  }
  function exportSrt() {
    const url = URL.createObjectURL(
      new Blob([toSrt(project.segments)], {
        type: "application/x-subrip;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "longray-vietnamese.srt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "Vietnamese subtitles exported from the current demo transcript.",
    );
  }
  return (
    <div className="app-shell" inert={!hydrated} data-hydrated={hydrated}>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="LONGRAY home">
          <span className="brand-icon">
            <AudioLines size={25} />
          </span>
          <span>
            LONGRAY<small>AI DUBBING STUDIO</small>
          </span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {[
            { name: "Dashboard", icon: LayoutDashboard },
            { name: "Studio", icon: AudioLines },
            { name: "Projects", icon: FolderOpen },
            { name: "Voice library", icon: Mic2 },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={view === name ? "nav active" : "nav"}
              onClick={() => setView(name)}
            >
              <Icon size={18} />
              {name}
              {name === "Studio" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="mini-icon">
            <Headphones size={19} />
          </span>
          <h4>Your stories. New voices.</h4>
          <p>Bring every conversation closer to a new audience.</p>
          <span>
            Russian <ArrowRight size={12} /> Vietnamese
          </span>
        </div>
        <div className="sidebar-bottom">
          <span className="avatar">L</span>
          <div>
            Personal workspace<small>Private · Local demo</small>
          </div>
          <Settings2 size={16} />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            Workspace <ChevronRight size={14} /> <strong>{view}</strong>
          </div>
          <span className="private">
            <span /> Private workspace
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">CREATE WITHOUT LANGUAGE BARRIERS</div>
              <h1>
                {view === "Studio"
                  ? "Dubbing studio"
                  : view === "Voice library"
                    ? "Voice library"
                    : "Your projects"}
                <span className="demo-tag">LOCAL DEMO</span>
              </h1>
              <p>
                A Russian conversation. A Vietnamese voice. A world of
                possibility.
              </p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setView("Studio");
                setProject({
                  ...structuredClone(demoProject),
                  name: "Untitled interview",
                  segments: demoProject.segments.map((s) => ({
                    ...s,
                    status: "Draft",
                  })),
                });
                setSaved(false);
                if (media) URL.revokeObjectURL(media.url);
                setMedia(null);
                setMessage(
                  "New demo project created with sample interview segments.",
                );
              }}
            >
              <Plus size={17} /> New project
            </button>
          </div>
          {view === "Voice library" ? (
            <section className="panel library">
              <h2>Meet your Vietnamese voices</h2>
              <p>Google Cloud Text-to-Speech · Chirp 3 HD · vi-VN</p>
              <div className="voice-grid">
                {voices.map((v) => (
                  <div key={v.name} className="voice-card">
                    <span className="voice-avatar">
                      <AudioLines />
                    </span>
                    <h3>{v.name}</h3>
                    <p>{v.gender} · Vietnamese</p>
                    <VoicePreview voice={v.name} notify={setMessage} />
                    <button
                      className="secondary"
                      onClick={() => {
                        setVoice(v.name);
                        setView("Studio");
                      }}
                    >
                      Use voice <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : view !== "Studio" ? (
            <section className="panel dashboard">
              <div className="section-title">
                <h2>Recent projects</h2>
                <Badge>1 project</Badge>
              </div>
              <button
                className="project-card"
                onClick={() => setView("Studio")}
              >
                <span className="project-image">
                  <AudioLines size={40} />
                </span>
                <div>
                  <h3>{project.name}</h3>
                  <p>
                    Russian → Vietnamese · {project.segments.length} sample
                    segments
                  </p>
                  <Badge>{reviewed} reviewed</Badge>
                </div>
                <ArrowUpRight />
              </button>
              <button
                className="secondary"
                onClick={() => {
                  restore();
                  setView("Studio");
                }}
              >
                <FolderOpen size={15} /> Open browser-saved project
              </button>
            </section>
          ) : (
            <>
              <div className="workflow">
                <div className="step selected">
                  <span>1</span>
                  <div>
                    Source & voices<small>Set up your project</small>
                  </div>
                </div>
                <div className="step-line" />
                <div className="step">
                  <span>2</span>
                  <div>
                    Transcript & translation<small>Review every detail</small>
                  </div>
                </div>
                <div className="step-line" />
                <div className="step">
                  <span>3</span>
                  <div>
                    Review & export<small>Share your story</small>
                  </div>
                </div>
              </div>
              <div className="workspace-grid">
                <section className="panel source-panel">
                  <div className="section-title">
                    <h2>
                      <span className="section-icon">
                        <FileVideo size={17} />
                      </span>
                      Source media
                    </h2>
                    <Badge>01</Badge>
                  </div>
                  <div
                    className={"upload-zone " + (drag ? "dragging" : "")}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDrag(true);
                    }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDrag(false);
                      upload(e.dataTransfer.files[0]);
                    }}
                  >
                    <span className="upload-icon">
                      <Upload size={23} />
                    </span>
                    <h3>
                      {media ? media.name : "Every great story starts here"}
                    </h3>
                    <p>Drag and drop your interview, or browse files</p>
                    <button
                      className="secondary"
                      onClick={() => input.current?.click()}
                    >
                      <Plus size={15} />{" "}
                      {media ? "Replace file" : "Choose file"}
                    </button>
                    <small>
                      MP4, MP3, WAV, M4A · Up to 500 MB · Stays on your device
                    </small>
                    <input
                      ref={input}
                      aria-label="Upload media"
                      type="file"
                      accept=".mp4,.mp3,.wav,.m4a"
                      hidden
                      onChange={(e) => {
                        upload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  {media && (
                    <video
                      ref={player}
                      controls
                      src={media.url}
                      className={
                        media.video
                          ? "media-player"
                          : "media-player audio-player"
                      }
                      aria-label="Source media player"
                    />
                  )}
                  <div className="language-row">
                    <div>
                      <label>Source language</label>
                      <strong>
                        <span>RU</span> Russian
                      </strong>
                    </div>
                    <span className="language-arrow">
                      <ArrowRight size={16} />
                    </span>
                    <div>
                      <label>Target language</label>
                      <strong>
                        <span>VN</span> Vietnamese
                      </strong>
                    </div>
                  </div>
                </section>
                <section className="panel voice-panel">
                  <div className="section-title">
                    <h2>
                      <span className="section-icon">
                        <SlidersHorizontal size={17} />
                      </span>
                      Voice settings
                    </h2>
                    <Badge>02</Badge>
                  </div>
                  <div className="provider">
                    <span className="google">G</span>
                    <div>
                      Google Cloud <small>Text-to-Speech</small>
                    </div>
                    <span className="model">Chirp 3 HD</span>
                  </div>
                  <label className="field-label" htmlFor="default-voice">
                    Default Vietnamese voice
                  </label>
                  <select
                    id="default-voice"
                    value={voice}
                    onChange={(e) => setVoice(e.target.value as Voice)}
                  >
                    {voices.map((v) => (
                      <option key={v.name}>{v.name}</option>
                    ))}
                  </select>
                  <div className="voice-meta">
                    <span className="green-dot" />
                    {voices.find((v) => v.name === voice)?.gender} voice{" "}
                    <span>vi-VN</span>
                  </div>
                  <VoicePreview voice={voice} notify={setMessage} />
                  <button
                    className="apply-voice"
                    onClick={() => {
                      setProject((p) => ({
                        ...p,
                        segments: p.segments.map((s) => ({
                          ...s,
                          voice,
                          status: "Draft",
                        })),
                      }));
                      setSaved(false);
                      setMessage(
                        `${voice} assigned to all segments. Review is required again.`,
                      );
                    }}
                  >
                    Apply to all segments <ArrowRight size={14} />
                  </button>
                  <p className="hint">
                    Voice selection only. No audio is generated in this demo.
                  </p>
                </section>
              </div>
              <section className="panel transcript">
                <div className="section-title transcript-heading">
                  <div>
                    <h2>
                      Transcript & translation{" "}
                      <Badge>{project.segments.length} segments</Badge>
                    </h2>
                    <p>Fine-tune the words. Keep the meaning.</p>
                  </div>
                  <div className="editor-actions">
                    <button
                      className="icon-button"
                      aria-label="Restore saved project"
                      title="Restore saved project"
                      onClick={restore}
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button className="secondary" onClick={save}>
                      <Check size={15} />
                      {saved ? "Saved locally" : "Save project"}
                    </button>
                  </div>
                </div>
                <div className="transcript-toolbar">
                  <span>
                    <span className="green-dot" /> Sample interview{" "}
                    <span className="toolbar-divider">/</span> 00:38 duration
                  </span>
                  <label className="search">
                    <Search size={15} />
                    <input
                      aria-label="Search transcript"
                      placeholder="Search transcript…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                </div>
                <div className="table-head">
                  <span>SEGMENT</span>
                  <span>ORIGINAL · RUSSIAN</span>
                  <span>TRANSLATION · VIETNAMESE</span>
                  <span>VOICE & STATUS</span>
                </div>
                <div className="segments">
                  {project.segments
                    .filter((s) =>
                      `${s.original} ${s.translation} ${s.speaker}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((s) => (
                      <article className="segment" key={s.id}>
                        <div className="segment-time">
                          <button
                            className="segment-play"
                            aria-label={`Seek to segment ${s.id}`}
                            onClick={() => {
                              if (player.current) {
                                player.current.currentTime = s.start;
                                player.current
                                  .play()
                                  .catch(() =>
                                    setMessage(
                                      "Press play in the media player to begin playback.",
                                    ),
                                  );
                              } else
                                setMessage(
                                  "Upload source media to play this segment.",
                                );
                            }}
                          >
                            <Play size={12} />
                          </button>
                          <span>
                            {timestamp(s.start)}
                            <small>{timestamp(s.end)}</small>
                          </span>
                        </div>
                        <div className="original">
                          <span
                            className={
                              "speaker " +
                              (s.speaker === "Speaker 2" ? "speaker-two" : "")
                            }
                          >
                            <span />
                            {s.speaker}
                          </span>
                          <p lang="ru">{s.original}</p>
                        </div>
                        <div className="translation">
                          <label
                            className="sr-only"
                            htmlFor={"translation-" + s.id}
                          >
                            Vietnamese translation {s.id}
                          </label>
                          <textarea
                            disabled={!hydrated}
                            id={"translation-" + s.id}
                            lang="vi"
                            value={s.translation}
                            onChange={(e) =>
                              update(s.id, {
                                translation: e.target.value,
                                status: "Draft",
                              })
                            }
                          />
                        </div>
                        <div className="segment-voice">
                          <select
                            aria-label={`Voice for segment ${s.id}`}
                            value={s.voice}
                            onChange={(e) =>
                              update(s.id, {
                                voice: e.target.value as Voice,
                                status: "Draft",
                              })
                            }
                          >
                            {voices.map((v) => (
                              <option key={v.name}>{v.name}</option>
                            ))}
                          </select>
                          <button
                            className={
                              s.status === "Reviewed"
                                ? "status reviewed"
                                : "status"
                            }
                            onClick={() => {
                              if (!s.translation.trim()) {
                                setMessage(
                                  "Add a translation before marking this segment reviewed.",
                                );
                                return;
                              }
                              update(s.id, {
                                status:
                                  s.status === "Reviewed"
                                    ? "Draft"
                                    : "Reviewed",
                              });
                            }}
                          >
                            {s.status === "Reviewed" ? (
                              <CheckCircle2 size={12} />
                            ) : (
                              <span className="status-dot" />
                            )}
                            {s.status === "Reviewed"
                              ? "Reviewed"
                              : "Mark reviewed"}
                          </button>
                        </div>
                      </article>
                    ))}
                  {!project.segments.some((s) =>
                    `${s.original} ${s.translation} ${s.speaker}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  ) && <p className="empty">No matching segments.</p>}
                </div>
                <div className="editor-footer">
                  <span>
                    <CheckCircle2 size={14} /> {reviewed} of{" "}
                    {project.segments.length} segments reviewed
                  </span>
                  <span>Edits stay in this session until saved locally</span>
                </div>
              </section>
              <div className="bottom-grid">
                <section className="panel processing">
                  <div className="section-title">
                    <h2>Processing overview</h2>
                    <Badge>Demo workspace</Badge>
                  </div>
                  <div className="processing-track">
                    {[
                      "Source media",
                      "Transcription",
                      "Translation",
                      "Voice-over",
                    ].map((s, i) => (
                      <div key={s}>
                        <span className={i === 0 && media ? "done" : ""}>
                          {i === 0 && media ? <Check size={14} /> : i + 1}
                        </span>
                        <strong>{s}</strong>
                        <small>
                          {i === 0
                            ? media
                              ? "Loaded locally"
                              : "Awaiting upload"
                            : i < 3
                              ? "Sample data"
                              : "Not connected"}
                        </small>
                      </div>
                    ))}
                  </div>
                  <p className="hint">
                    No background jobs or external API calls are running.
                  </p>
                </section>
                <section className="panel export-panel">
                  <div className="section-title">
                    <h2>Ready for the next chapter?</h2>
                    <Download size={17} />
                  </div>
                  <p>
                    Export your Vietnamese subtitles, or prepare for future
                    audio and video rendering.
                  </p>
                  <div className="export-buttons">
                    <button className="primary" onClick={exportSrt}>
                      <Download size={14} /> SRT
                    </button>
                    <button
                      className="secondary"
                      disabled
                      title="Requires future speech synthesis"
                    >
                      WAV <span>Soon</span>
                    </button>
                    <button
                      className="secondary"
                      disabled
                      title="Requires future rendering worker"
                    >
                      MP4 <span>Soon</span>
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
          <footer className="page-footer">
            <span>LONGRAY AI Dubbing Studio</span>
            <span>Thoughtfully translated. Naturally heard.</span>
            <span>Foundation · v0.1</span>
          </footer>
        </main>
      </div>
      {message && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          <span>{message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
