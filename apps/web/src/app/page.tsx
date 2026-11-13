"use client";

import { useEffect, useRef, useState } from "react";
import { Waveform } from "@/components/waveform";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function fileUrl(path: string) {
  if (path.startsWith("http")) return path;
  if (path.startsWith("/files/")) return `${API}${path}`;
  return `${API}/files/${path}`;
}
const PX_PER_SECOND = 40;

type Clip = {
  id: string;
  fileId: string;
  name: string;
  start: number;
  duration: number;
  offset: number;
  volume: number;
};

type Track = {
  id: string;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  clips: Clip[];
};

type Project = {
  id: string;
  name: string;
  master_volume: number;
  tracks: Track[];
};

function newId() {
  return crypto.randomUUID();
}

function emptyProject(name: string): Project {
  return {
    id: "",
    name,
    master_volume: 1,
    tracks: [
      { id: newId(), name: "Track 1", volume: 1, pan: 0, muted: false, solo: false, clips: [] },
      { id: newId(), name: "Track 2", volume: 1, pan: 0, muted: false, solo: false, clips: [] },
    ],
  };
}

export default function StudioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [prompt, setPrompt] = useState("Raï algérien moderne, guitare, derbouka, ambiance festive, 120 BPM");
  const [duration, setDuration] = useState(15);
  const [language, setLanguage] = useState("ar");
  const [lyrics, setLyrics] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [uploadedFileId, setUploadedFileId] = useState("");
  const [selectedClipId, setSelectedClipId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [masterVolume, setMasterVolume] = useState(1);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const buffersRef = useRef<Record<string, AudioBuffer>>({});
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  async function loadProjects() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/projects`);
    const data = await res.json();
    setProjects(data.items || []);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    const timer = setInterval(async () => {
      const active = jobs.filter((job) => job.status === "queued" || job.status === "running");
      if (!active.length) return;
      const updated = await Promise.all(active.map(async (job) => (await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/jobs/${job.id}`)).json()));
      setJobs((current) => current.map((job) => updated.find((item: any) => item.id === job.id) || job));
    }, 2000);
    return () => clearInterval(timer);
  }, [jobs]);

  async function createProject() {
    if (!newProjectName.trim()) return;
    const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${api}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProjectName.trim() }),
    });
    const created = await res.json();
    const fullProject = { ...emptyProject(created.name), id: created.id, tracks: emptyProject(created.name).tracks };
    await fetch(`${api}/projects/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fullProject),
    });
    setProjects((current) => [fullProject, ...current]);
    setSelectedProjectId(created.id);
    setProject(fullProject);
    setNewProjectName("");
    setMessage(`Project created: ${created.name}`);
  }

  async function loadProject(id: string) {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${api}/projects/${id}`);
    const data = await res.json();
    const normalized: Project = {
      id: data.id,
      name: data.name,
      master_volume: data.master_volume ?? 1,
      tracks: data.tracks || emptyProject(data.name).tracks,
    };
    setProject(normalized);
    setSelectedProjectId(id);
    setCurrentTime(0);
    stopPlayback();
  }

  async function saveProject() {
    if (!project) return;
    const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const updated = { ...project, updated_at: new Date().toISOString() };
    await fetch(`${api}/projects/${project.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    setProject(updated);
    setMessage("Project saved.");
    await loadProjects();
  }

  async function uploadAudio(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${api}/uploads`, { method: "POST", body: form });
    const data = await res.json();
    setUploadedFileId(data.id);
    setMessage(`Uploaded: ${data.filename} (${Math.round((data.duration || 0) * 10) / 10}s)`);
  }

  function addClipToTrack(trackId: string, fileId: string, name: string, duration: number) {
    if (!project) return;
    const clip: Clip = {
      id: newId(),
      fileId,
      name,
      start: 0,
      duration: duration || 5,
      offset: 0,
      volume: 1,
    };
    setProject({
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === trackId ? { ...track, clips: [...track.clips, clip] } : track,
      ),
    });
  }

  function removeClip(clipId: string) {
    if (!project) return;
    setProject({
      ...project,
      tracks: project.tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((clip) => clip.id !== clipId),
      })),
    });
    if (selectedClipId === clipId) setSelectedClipId("");
  }

  function updateTrack(trackId: string, changes: Partial<Track>) {
    if (!project) return;
    setProject({
      ...project,
      tracks: project.tracks.map((track) => (track.id === trackId ? { ...track, ...changes } : track)),
    });
  }

  function updateClip(clipId: string, changes: Partial<Clip>) {
    if (!project) return;
    setProject({
      ...project,
      tracks: project.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => (clip.id === clipId ? { ...clip, ...changes } : clip)),
      })),
    });
  }

  async function getAudioBuffer(fileId: string) {
    if (buffersRef.current[fileId]) return buffersRef.current[fileId];
    const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const response = await fetch(`${api}/files/${fileId}`);
    const arrayBuffer = await response.arrayBuffer();
    const context = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = context;
    const buffer = await context.decodeAudioData(arrayBuffer);
    buffersRef.current[fileId] = buffer;
    return buffer;
  }

  function stopPlayback() {
    sourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // ignore
      }
    });
    sourcesRef.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
  }

  async function play() {
    if (!project || isPlaying) return;
    const context = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = context;
    await context.resume();
    const masterGain = context.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(context.destination);

    const soloExists = project.tracks.some((track) => track.solo);
    const startAt = context.currentTime + 0.05;
    const offset = currentTime;

    for (const track of project.tracks) {
      if (track.muted || (soloExists && !track.solo)) continue;
      const trackGain = context.createGain();
      const panner = context.createStereoPanner();
      trackGain.gain.value = track.volume;
      panner.pan.value = track.pan;
      trackGain.connect(panner);
      panner.connect(masterGain);

      for (const clip of track.clips) {
        const clipEnd = clip.start + clip.duration;
        if (clipEnd <= offset) continue;
        const buffer = await getAudioBuffer(clip.fileId);
        const source = context.createBufferSource();
        source.buffer = buffer;
        const clipOffsetInBuffer = clip.offset + Math.max(0, offset - clip.start);
        const when = startAt + Math.max(0, clip.start - offset);
        const playDuration = clipEnd - Math.max(clip.start, offset);
        source.connect(trackGain);
        source.start(when, clipOffsetInBuffer, playDuration);
        sourcesRef.current.push(source);
      }
    }

    startTimeRef.current = startAt;
    offsetRef.current = offset;
    setIsPlaying(true);

    const tick = () => {
      if (!audioContextRef.current) return;
      const elapsed = audioContextRef.current.currentTime - startTimeRef.current + offsetRef.current;
      setCurrentTime(elapsed);
      if (elapsed < totalDuration()) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        stopPlayback();
        setCurrentTime(0);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function totalDuration() {
    if (!project) return 0;
    return Math.max(0, ...project.tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration)), 0);
  }

  function pause() {
    stopPlayback();
  }

  function stop() {
    stopPlayback();
    setCurrentTime(0);
  }

  function seek(value: number) {
    stopPlayback();
    setCurrentTime(value);
  }

  async function generateMusic() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${api}/jobs/generate-music`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, duration, language, lyrics, bpm: null }),
    });
    const job = await res.json();
    setJobs((current) => [job, ...current]);
    setMessage(`Music generation started: ${job.id}`);
  }

  async function separateSelectedClip() {
    const selected = findSelectedClip();
    if (!selected) {
      setMessage("Select a clip first.");
      return;
    }
    const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${api}/jobs/separate-stems`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: selected.fileId }),
    });
    const job = await res.json();
    setJobs((current) => [job, ...current]);
    setMessage(`Stem separation started: ${job.id}`);
  }

  async function processSelectedClip(operation: "normalize" | "trim") {
    const selected = findSelectedClip();
    if (!selected) {
      setMessage("Select a clip first.");
      return;
    }
    const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${api}/jobs/process-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: selected.fileId, operation }),
    });
    const job = await res.json();
    setJobs((current) => [job, ...current]);
    setMessage(`Audio processing started: ${job.id}`);
  }

  async function exportProject(format: "wav" | "mp3") {
    if (!project) return;
    const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    await fetch(`${api}/projects/${project.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
    const res = await fetch(`${api}/jobs/export-project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: project.id, format }),
    });
    const job = await res.json();
    setJobs((current) => [job, ...current]);
    setMessage(`Export started: ${job.id}`);
  }

  function findSelectedClip() {
    if (!project || !selectedClipId) return null;
    for (const track of project.tracks) {
      const clip = track.clips.find((item) => item.id === selectedClipId);
      if (clip) return clip;
    }
    return null;
  }

  function handleClipPointerDown(event: React.PointerEvent, clipId: string) {
    if (!project) return;
    setSelectedClipId(clipId);
    const clip = project.tracks.flatMap((track) => track.clips).find((item) => item.id === clipId);
    if (!clip) return;
    const startX = event.clientX;
    const startTime = clip.start;
    const onMove = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) / PX_PER_SECOND;
      updateClip(clipId, { start: Math.max(0, startTime + delta) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  return (
    <div className="studio">
      <header className="topbar">
        <div>
          <strong>MUSTAPHA AUDIO STUDIO</strong>
          <span style={{ marginLeft: 12, color: "var(--muted)", fontSize: 12 }}>Editing core</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn secondary" onClick={() => (project ? saveProject() : setMessage("Create or load a project first."))}>
            Save project
          </button>
          <button className="btn" onClick={() => exportProject("wav")}>Export WAV</button>
          <button className="btn secondary" onClick={() => exportProject("mp3")}>Export MP3</button>
        </div>
      </header>

      <aside className="sidebar">
        <p className="panel-title">Projects</p>
        <div className="card">
          <input className="input" placeholder="New project name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
          <button className="btn" onClick={createProject} style={{ width: "100%" }}>Create project</button>
        </div>
        {projects.map((item) => (
          <button
            key={item.id}
            className="btn secondary"
            style={{ width: "100%", marginBottom: 8, justifyContent: "flex-start", background: selectedProjectId === item.id ? "var(--accent)" : undefined, color: selectedProjectId === item.id ? "#001018" : undefined }}
            onClick={() => loadProject(item.id)}
          >
            {item.name}
          </button>
        ))}

        <p className="panel-title" style={{ marginTop: 16 }}>Upload audio</p>
        <div className="card">
          <input type="file" accept="audio/*" onChange={uploadAudio} />
          {uploadedFileId && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>Uploaded file ID: {uploadedFileId}</p>}
          {uploadedFileId && project && (
            <button className="btn secondary" style={{ width: "100%", marginTop: 8 }} onClick={() => addClipToTrack(project.tracks[0].id, uploadedFileId, "Imported audio", 5)}>
              Add to first track
            </button>
          )}
        </div>

        <p className="panel-title" style={{ marginTop: 16 }}>AI Music Composer</p>
        <div className="card">
          <textarea className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input className="input" type="number" min={5} max={60} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="ar">Arabic</option>
              <option value="en">English</option>
              <option value="fr">French</option>
            </select>
          </div>
          <input className="input" value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="Lyrics (optional)" />
          <button className="btn" style={{ width: "100%" }} onClick={generateMusic}>Generate music</button>
        </div>
      </aside>

      <section className="workspace">
        {!project ? (
          <div className="card">Create or load a project to start editing.</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{project.name}</h1>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                Duration: {totalDuration().toFixed(1)}s · Master volume: {masterVolume.toFixed(2)}
              </div>
            </div>

            {project.tracks.map((track) => (
              <div key={track.id} className="track">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <strong>{track.name}</strong>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <label style={{ fontSize: 11, color: "var(--muted)" }}>Vol</label>
                    <input type="range" min={0} max={1} step={0.01} value={track.volume} onChange={(e) => updateTrack(track.id, { volume: Number(e.target.value) })} />
                    <label style={{ fontSize: 11, color: "var(--muted)" }}>Pan</label>
                    <input type="range" min={-1} max={1} step={0.01} value={track.pan} onChange={(e) => updateTrack(track.id, { pan: Number(e.target.value) })} />
                    <button className={`btn secondary ${track.muted ? "active" : ""}`} onClick={() => updateTrack(track.id, { muted: !track.muted })}>M</button>
                    <button className={`btn secondary ${track.solo ? "active" : ""}`} onClick={() => updateTrack(track.id, { solo: !track.solo })}>S</button>
                  </div>
                </div>

                <div style={{ position: "relative", minHeight: 74, background: "#0a0f1a", borderRadius: 8, overflow: "hidden" }}>
                  {track.clips.map((clip) => (
                    <div
                      key={clip.id}
                      onPointerDown={(event) => handleClipPointerDown(event, clip.id)}
                      onClick={() => setSelectedClipId(clip.id)}
                      style={{
                        position: "absolute",
                        left: clip.start * PX_PER_SECOND,
                        width: Math.max(20, clip.duration * PX_PER_SECOND),
                        top: 8,
                        height: 58,
                        background: selectedClipId === clip.id ? "rgba(34,211,238,.28)" : "rgba(167,139,250,.22)",
                        border: selectedClipId === clip.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                        borderRadius: 6,
                        padding: 6,
                        cursor: "grab",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{clip.name}</div>
                      <Waveform url={`${api}/files/${clip.fileId}`} height={30} />
                      <div
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          const startX = event.clientX;
                          const startDuration = clip.duration;
                          const onMove = (moveEvent: PointerEvent) => {
                            const delta = (moveEvent.clientX - startX) / PX_PER_SECOND;
                            updateClip(clip.id, { duration: Math.max(0.5, startDuration + delta) });
                          };
                          const onUp = () => {
                            window.removeEventListener("pointermove", onMove);
                            window.removeEventListener("pointerup", onUp);
                          };
                          window.addEventListener("pointermove", onMove);
                          window.addEventListener("pointerup", onUp);
                        }}
                        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, cursor: "ew-resize", background: "rgba(255,255,255,.08)" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button className="btn secondary" onClick={() => (selectedClipId ? removeClip(selectedClipId) : setMessage("Select a clip first."))}>
                Delete selected clip
              </button>
              <button className="btn secondary" onClick={() => exportProject("wav")}>Export WAV</button>
              <button className="btn secondary" onClick={() => exportProject("mp3")}>Export MP3</button>
            </div>

            {message && <div className="card" style={{ color: "var(--accent)", marginTop: 12 }}>{message}</div>}

            <p className="panel-title" style={{ marginTop: 16 }}>Jobs</p>
            {jobs.map((job) => (
              <div key={job.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{job.kind}</strong>
                  <span style={{ color: job.status === "succeeded" ? "var(--ok)" : job.status === "failed" ? "var(--danger)" : "var(--muted)" }}>
                    {job.status} ({job.progress}%)
                  </span>
                </div>
                {job.error && <pre style={{ whiteSpace: "pre-wrap", color: "var(--danger)", fontSize: 12 }}>{job.error}</pre>}
                {job.result?.download_url && (
                  <div style={{ marginTop: 8 }}>
                    <audio controls src={fileUrl(job.result.download_url)} style={{ width: "100%" }} />
                    <a href={fileUrl(job.result.download_url)} download style={{ color: "var(--accent)", fontSize: 12 }}>
                      Download
                    </a>
                  </div>
                )}
                {job.result?.download_urls && (
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    {job.result.download_urls.map((url: string, index: number) => (
                      <div key={url}>
                        <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--muted)" }}>Stem {index + 1}</p>
                        <audio controls src={fileUrl(url)} style={{ width: "100%" }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </section>

      <aside className="inspector">
        <p className="panel-title">Transport</p>
        <div className="card">
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button className="btn" onClick={play} disabled={isPlaying}>Play</button>
            <button className="btn secondary" onClick={pause} disabled={!isPlaying}>Pause</button>
            <button className="btn secondary" onClick={stop}>Stop</button>
          </div>
          <label>Seek: {currentTime.toFixed(1)}s / {totalDuration().toFixed(1)}s</label>
          <input type="range" min={0} max={Math.max(totalDuration(), 0.1)} step={0.1} value={currentTime} onChange={(e) => seek(Number(e.target.value))} style={{ width: "100%" }} />
          <label>Master volume: {masterVolume.toFixed(2)}</label>
          <input type="range" min={0} max={1} step={0.01} value={masterVolume} onChange={(e) => setMasterVolume(Number(e.target.value))} style={{ width: "100%" }} />
        </div>

        <p className="panel-title">Mixer</p>
        {project?.tracks.map((track) => (
          <div key={track.id} className="card">
            <strong style={{ fontSize: 13 }}>{track.name}</strong>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 6 }}>Volume {track.volume.toFixed(2)}</label>
            <input type="range" min={0} max={1} step={0.01} value={track.volume} onChange={(e) => updateTrack(track.id, { volume: Number(e.target.value) })} style={{ width: "100%" }} />
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 6 }}>Pan {track.pan.toFixed(2)}</label>
            <input type="range" min={-1} max={1} step={0.01} value={track.pan} onChange={(e) => updateTrack(track.id, { pan: Number(e.target.value) })} style={{ width: "100%" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className={`btn secondary ${track.muted ? "active" : ""}`} onClick={() => updateTrack(track.id, { muted: !track.muted })}>Mute</button>
              <button className={`btn secondary ${track.solo ? "active" : ""}`} onClick={() => updateTrack(track.id, { solo: !track.solo })}>Solo</button>
            </div>
          </div>
        ))}

        <p className="panel-title">Jobs</p>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {jobs.length ? `${jobs.length} job(s) tracked.` : "No jobs yet."}
        </div>
      </aside>

      <div className="timeline">
        <p className="panel-title">Timeline</p>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
          Clips are positioned by start time. Drag a clip to move it. Drag the right edge to resize. Multiple tracks are supported. Original files are not modified.
        </p>
      </div>
    </div>
  );
}
