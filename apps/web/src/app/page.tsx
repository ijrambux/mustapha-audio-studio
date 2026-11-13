"use client";

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Project = { id: string; name: string; created_at: string; assets: any[] };
type Job = {
  id: string;
  kind: string;
  status: string;
  progress: number;
  result: any;
  error: string | null;
};

export default function StudioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [prompt, setPrompt] = useState("Raï algérien moderne, guitare, derbouka, ambiance festive, 120 BPM");
  const [duration, setDuration] = useState(20);
  const [language, setLanguage] = useState("ar");
  const [lyrics, setLyrics] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("");
  const [uploadedFileId, setUploadedFileId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadProjects() {
    const res = await fetch(`${API}/projects`);
    const data = await res.json();
    setProjects(data.items || []);
    if (!selectedProject && data.items?.length) {
      setSelectedProject(data.items[0].id);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    const timer = setInterval(async () => {
      const active = jobs.filter((job) => job.status === "queued" || job.status === "running");
      if (!active.length) return;
      const updated = await Promise.all(
        active.map(async (job) => {
          const res = await fetch(`${API}/jobs/${job.id}`);
          return res.json();
        }),
      );
      setJobs((current) =>
        current.map((job) => {
          const fresh = updated.find((item) => item.id === job.id);
          return fresh || job;
        }),
      );
    }, 2000);
    return () => clearInterval(timer);
  }, [jobs]);

  async function createProject() {
    if (!newProjectName.trim()) return;
    const res = await fetch(`${API}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProjectName.trim() }),
    });
    const project = await res.json();
    setProjects((current) => [project, ...current]);
    setSelectedProject(project.id);
    setNewProjectName("");
    setMessage(`Project created: ${project.name}`);
  }

  async function uploadAudio(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/uploads`, { method: "POST", body: form });
    const data = await res.json();
    setUploadedFileId(data.id);
    setMessage(`Uploaded: ${data.filename} (${data.size} bytes)`);
  }

  async function generateMusic() {
    const res = await fetch(`${API}/jobs/generate-music`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        duration,
        language,
        lyrics,
        bpm: null,
      }),
    });
    const job = await res.json();
    setJobs((current) => [job, ...current]);
    setMessage(`Music generation job created: ${job.id}`);
  }

  async function separateStems() {
    if (!uploadedFileId) {
      setMessage("Upload an audio file first.");
      return;
    }
    const res = await fetch(`${API}/jobs/separate-stems`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: uploadedFileId }),
    });
    const job = await res.json();
    setJobs((current) => [job, ...current]);
    setMessage(`Stem separation job created: ${job.id}`);
  }

  async function processAudio(operation: "normalize" | "trim") {
    if (!uploadedFileId) {
      setMessage("Upload an audio file first.");
      return;
    }
    const res = await fetch(`${API}/jobs/process-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: uploadedFileId, operation }),
    });
    const job = await res.json();
    setJobs((current) => [job, ...current]);
    setMessage(`Audio processing job created: ${job.id}`);
  }

  function fileUrl(fileIdOrPath: string) {
    if (fileIdOrPath.startsWith("/files/")) return `${API}${fileIdOrPath}`;
    if (fileIdOrPath.startsWith("http")) return fileIdOrPath;
    return `${API}/files/${fileIdOrPath}`;
  }

  return (
    <div className="studio">
      <header className="topbar">
        <div>
          <strong>MUSTAPHA AUDIO STUDIO</strong>
          <span style={{ marginLeft: 12, color: "var(--muted)", fontSize: 12 }}>
            Local-first audio production
          </span>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          {selectedProject ? `Project: ${projects.find((p) => p.id === selectedProject)?.name}` : "No project selected"}
        </div>
      </header>

      <aside className="sidebar">
        <p className="panel-title">Projects</p>
        <div className="card">
          <input
            className="input"
            placeholder="New project name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <button className="btn" onClick={createProject}>Create project</button>
        </div>
        {projects.map((project) => (
          <button
            key={project.id}
            className={`btn secondary ${selectedProject === project.id ? "active" : ""}`}
            style={{ width: "100%", marginBottom: 8, justifyContent: "flex-start" }}
            onClick={() => setSelectedProject(project.id)}
          >
            {project.name}
          </button>
        ))}
        {!projects.length && <p style={{ color: "var(--muted)", fontSize: 12 }}>No projects yet.</p>}

        <p className="panel-title" style={{ marginTop: 16 }}>Upload audio</p>
        <div className="card">
          <input ref={fileInputRef} type="file" accept="audio/*" onChange={uploadAudio} />
          {uploadedFileId && <p style={{ fontSize: 12, color: "var(--muted)" }}>File ID: {uploadedFileId}</p>}
        </div>
      </aside>

      <section className="workspace">
        <p className="panel-title">AI Music Composer</p>
        <div className="card">
          <label>Prompt</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <label>Duration (seconds)</label>
              <input className="input" type="number" min={5} max={60} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
            <div>
              <label>Language</label>
              <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="ar">Arabic</option>
                <option value="en">English</option>
                <option value="fr">French</option>
              </select>
            </div>
            <div>
              <label>Lyrics (optional)</label>
              <input className="input" value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="Leave empty for instrumental" />
            </div>
          </div>
          <button className="btn" onClick={generateMusic}>Generate music</button>
        </div>

        <p className="panel-title">Audio tools</p>
        <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn secondary" onClick={separateStems}>Separate stems</button>
          <button className="btn secondary" onClick={() => processAudio("normalize")}>Normalize audio</button>
          <button className="btn secondary" onClick={() => processAudio("trim")}>Trim 10s</button>
        </div>

        {message && <div className="card" style={{ color: "var(--accent)" }}>{message}</div>}

        <p className="panel-title">Jobs</p>
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
        {!jobs.length && <p style={{ color: "var(--muted)", fontSize: 12 }}>No jobs yet.</p>}
      </section>

      <aside className="inspector">
        <p className="panel-title">Mixer (basic)</p>
        <div className="card">
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            Upload or generate audio, then use jobs to preview results. Advanced mixer routing will be added after the core engine is stable.
          </p>
        </div>

        <p className="panel-title">Timeline</p>
        <div className="card">
          <div className="waveform" />
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            Timeline and clip editing are scaffolded. Full drag-and-drop editing will be connected to real audio segments in the next iteration.
          </p>
        </div>

        <p className="panel-title">Notes</p>
        <div className="card" style={{ fontSize: 12, color: "var(--muted)" }}>
          <p>Engines run locally. Generation may take several minutes on CPU.</p>
          <p>No cloud GPU is assumed.</p>
          <p>Model licenses must be verified before public release.</p>
        </div>
      </aside>

      <div className="timeline">
        <p className="panel-title">Transport</p>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
          Transport controls will be connected to the Web Audio engine after the first end-to-end audio pipeline is validated.
        </p>
      </div>
    </div>
  );
}
