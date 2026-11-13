from __future__ import annotations

import json
import os
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
STORAGE = ROOT / "storage"
PROJECTS = STORAGE / "projects"
UPLOADS = STORAGE / "uploads"
JOBS = STORAGE / "jobs"
OUTPUTS = STORAGE / "outputs"

for directory in (STORAGE, PROJECTS, UPLOADS, JOBS, OUTPUTS):
    directory.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="MUSTAPHA AUDIO STUDIO API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs: dict[str, dict[str, Any]] = {}


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class GenerateMusicRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=1000)
    duration: int = Field(default=20, ge=5, le=60)
    language: str = Field(default="ar", max_length=8)
    lyrics: str = Field(default="", max_length=4000)
    bpm: int | None = Field(default=None, ge=40, le=240)


class SeparateStemsRequest(BaseModel):
    file_id: str


class ProcessAudioRequest(BaseModel):
    file_id: str
    operation: str = Field(pattern="^(normalize|trim)$")


class ExportProjectRequest(BaseModel):
    project_id: str
    format: str = Field(default="wav", pattern="^(wav|mp3)$")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def project_path(project_id: str) -> Path:
    return PROJECTS / project_id / "project.json"


def load_project(project_id: str) -> dict[str, Any]:
    path = project_path(project_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    return json.loads(path.read_text(encoding="utf-8"))


def save_project(project: dict[str, Any]) -> None:
    path = project_path(project["id"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8")


def new_job(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "kind": kind,
        "status": "queued",
        "progress": 0,
        "payload": payload,
        "result": None,
        "error": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    jobs[job_id] = job
    return job


def update_job(job_id: str, **changes: Any) -> None:
    job = jobs[job_id]
    job.update(changes)
    job["updated_at"] = now_iso()


def safe_file(path: Path) -> Path:
    resolved = path.resolve()
    if STORAGE not in resolved.parents and resolved != STORAGE:
        raise HTTPException(status_code=400, detail="Invalid file path")
    return resolved


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "MUSTAPHA AUDIO STUDIO API",
        "version": "0.1.0",
        "storage": str(STORAGE),
    }


@app.get("/projects")
def list_projects() -> dict[str, Any]:
    projects = []
    for path in sorted(PROJECTS.glob("*/project.json")):
        try:
            projects.append(json.loads(path.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError):
            continue
    return {"items": projects}


@app.post("/projects")
def create_project(payload: ProjectCreate) -> dict[str, Any]:
    project = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "assets": [],
    }
    save_project(project)
    return project


@app.get("/projects/{project_id}")
def get_project(project_id: str) -> dict[str, Any]:
    return load_project(project_id)


@app.put("/projects/{project_id}")
def update_project(project_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    project = load_project(project_id)
    project.update(payload)
    project["id"] = project_id
    project["updated_at"] = now_iso()
    if "assets" not in project:
        project["assets"] = []
    save_project(project)
    return project

class ExportProjectRequest(BaseModel):
    project_id: str
    format: str = Field(default="wav", pattern="^(wav|mp3)$")


def probe_duration(path: Path) -> float | None:
    try:
        completed = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        value = completed.stdout.strip()
        return float(value) if value else None
    except (ValueError, OSError, subprocess.SubprocessError):
        return None


@app.post("/uploads")
async def upload_audio(file: UploadFile = File(...)) -> dict[str, Any]:
    file_id = str(uuid.uuid4())
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    destination = UPLOADS / f"{file_id}{suffix}"
    with destination.open("wb") as handle:
        while chunk := await file.read(1024 * 1024):
            handle.write(chunk)
    return {
        "id": file_id,
        "filename": file.filename,
        "path": str(destination),
        "size": destination.stat().st_size,
        "duration": probe_duration(destination),
    }


@app.get("/files/{file_id}")
def get_file(file_id: str) -> FileResponse:
    matches = [p for p in STORAGE.rglob(f"{file_id}.*") if p.is_file()]
    if not matches:
        matches = [p for p in STORAGE.rglob("*") if p.is_file() and file_id in p.name]
    if not matches:
        raise HTTPException(status_code=404, detail="File not found")
    path = safe_file(matches[0])
    return FileResponse(path)


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


@app.post("/jobs/generate-music")
def generate_music_job(request: GenerateMusicRequest, background_tasks: BackgroundTasks) -> dict[str, Any]:
    job = new_job("generate_music", request.model_dump())
    background_tasks.add_task(run_generate_music, job["id"], request)
    return job


@app.post("/jobs/separate-stems")
def separate_stems_job(request: SeparateStemsRequest, background_tasks: BackgroundTasks) -> dict[str, Any]:
    matches = list(UPLOADS.glob(f"{request.file_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Uploaded file not found")
    job = new_job("separate_stems", {"file_id": request.file_id, "path": str(matches[0])})
    background_tasks.add_task(run_separate_stems, job["id"], matches[0])
    return job


@app.post("/jobs/process-audio")
def process_audio_job(request: ProcessAudioRequest, background_tasks: BackgroundTasks) -> dict[str, Any]:
    matches = list(UPLOADS.glob(f"{request.file_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Uploaded file not found")
    job = new_job("process_audio", {"file_id": request.file_id, "path": str(matches[0]), "operation": request.operation})
    background_tasks.add_task(run_process_audio, job["id"], matches[0], request.operation)
    return job


def run_generate_music(job_id: str, request: GenerateMusicRequest) -> None:
    update_job(job_id, status="running", progress=5)
    output_dir = JOBS / job_id / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["MUSIC_PROMPT"] = request.prompt
    env["MUSIC_DURATION"] = str(request.duration)
    env["MUSIC_LANGUAGE"] = request.language
    env["MUSIC_LYRICS"] = request.lyrics
    env["ACE_OUTPUT_DIR"] = str(output_dir)
    if request.bpm is not None:
        env["MUSIC_BPM"] = str(request.bpm)

    engine_dir = ROOT / "engines" / "ace-step" / "ACE-Step-1.5"
    try:
        completed = subprocess.run(
            ["uv", "run", "python", "api_generate.py"],
            cwd=engine_dir,
            env=env,
            capture_output=True,
            text=True,
            timeout=900,
        )
        output = completed.stdout + "\n" + completed.stderr
        output_file = None
        for line in completed.stdout.splitlines():
            if line.startswith("ACE_OUTPUT="):
                output_file = line.split("=", 1)[1].strip()
        if completed.returncode == 0 and output_file:
            update_job(
                job_id,
                status="succeeded",
                progress=100,
                result={
                    "engine": "audio-engine",
                    "output_file": output_file,
                    "filename": Path(output_file).name,
                    "download_url": f"/files/{Path(output_file).stem}",
                },
            )
        else:
            update_job(job_id, status="failed", progress=100, error=output[-2000:])
    except Exception as exc:
        update_job(job_id, status="failed", progress=100, error=str(exc))


def run_separate_stems(job_id: str, input_path: Path) -> None:
    update_job(job_id, status="running", progress=5)
    output_dir = JOBS / job_id / "stems"
    output_dir.mkdir(parents=True, exist_ok=True)
    try:
        completed = subprocess.run(
            ["python", "-m", "demucs", "-n", "htdemucs", "-d", "cpu", "-o", str(output_dir), str(input_path)],
            capture_output=True,
            text=True,
            timeout=900,
        )
        output = completed.stdout + "\n" + completed.stderr
        stems = [str(p) for p in output_dir.rglob("*.wav") if p.is_file()]
        if completed.returncode == 0 and stems:
            update_job(
                job_id,
                status="succeeded",
                progress=100,
                result={
                    "engine": "audio-engine",
                    "stems": stems,
                    "download_urls": [f"/files/{Path(stem).stem}" for stem in stems],
                },
            )
        else:
            update_job(job_id, status="failed", progress=100, error=output[-2000:])
    except Exception as exc:
        update_job(job_id, status="failed", progress=100, error=str(exc))


def run_process_audio(job_id: str, input_path: Path, operation: str) -> None:
    update_job(job_id, status="running", progress=5)
    output_dir = JOBS / job_id / "processed"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{input_path.stem}-{operation}.mp3"
    filters = {
        "normalize": "loudnorm=I=-16:TP=-1.5:LRA=11",
        "trim": "atrim=0:10",
    }
    try:
        completed = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(input_path),
                "-af",
                filters[operation],
                "-ar",
                "44100",
                "-ac",
                "2",
                str(output_path),
            ],
            capture_output=True,
            text=True,
            timeout=300,
        )
        output = completed.stdout + "\n" + completed.stderr
        if completed.returncode == 0 and output_path.exists():
            update_job(
                job_id,
                status="succeeded",
                progress=100,
                result={
                    "engine": "audio-engine",
                    "output_file": str(output_path),
                    "filename": output_path.name,
                    "download_url": f"/files/{output_path.stem}",
                },
            )
        else:
            update_job(job_id, status="failed", progress=100, error=output[-2000:])
    except Exception as exc:
        update_job(job_id, status="failed", progress=100, error=str(exc))


@app.post("/jobs/export-project")
def export_project_job(request: ExportProjectRequest, background_tasks: BackgroundTasks) -> dict[str, Any]:
    project = load_project(request.project_id)
    job = new_job("export_project", {"project_id": request.project_id, "format": request.format})
    background_tasks.add_task(run_export_project, job["id"], project, request.format)
    return job
def run_export_project(job_id: str, project: dict[str, Any], output_format: str) -> None:
    update_job(job_id, status="running", progress=5)
    output_dir = JOBS / job_id / "export"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"project-export.{output_format}"

    tracks = project.get("tracks", [])
    solo_exists = any(track.get("solo") for track in tracks)

    inputs: list[str] = []
    filter_parts: list[str] = []
    mix_labels: list[str] = []

    for track_index, track in enumerate(tracks):
        for clip_index, clip in enumerate(track.get("clips", [])):
            file_id = clip.get("file_id") or clip.get("fileId")
            matches = [p for p in STORAGE.rglob(f"{file_id}.*") if p.is_file()]
            if not matches:
                continue
            input_path = matches[0]
            inputs.extend(["-i", str(input_path)])

            start = float(clip.get("start", 0) or 0)
            offset = float(clip.get("offset", 0) or 0)
            duration = float(clip.get("duration", 0) or 0)
            volume = float(track.get("volume", 1.0) or 1.0)
            pan = float(track.get("pan", 0) or 0)
            muted = bool(track.get("muted", False))
            solo = bool(track.get("solo", False))

            if muted or (solo_exists and not solo):
                continue

            delay_ms = int(start * 1000)
            left_gain = max(0.0, min(1.0, 1.0 - max(0.0, pan)))
            right_gain = max(0.0, min(1.0, 1.0 + min(0.0, pan)))
            label = f"a{track_index}_{clip_index}"

            filter_parts.append(
                f"[{len(inputs)//2 - 1}:a]"
                f"atrim=start={offset}:duration={duration},"
                f"asetpts=PTS-STARTPTS,"
                f"adelay={delay_ms}|{delay_ms},"
                f"volume={volume},"
                f"pan=stereo|c0={left_gain}*c0|c1={right_gain}*c1"
                f"[{label}]"
            )
            mix_labels.append(f"[{label}]")

    if not mix_labels:
        update_job(job_id, status="failed", progress=100, error="No playable clips to export")
        return

    filter_complex = ";".join(filter_parts + [f"{''.join(mix_labels)}amix=inputs={len(mix_labels)}:duration=longest:normalize=0[mix]"])
    master_volume = float(project.get("master_volume", 1.0) or 1.0)
    filter_complex += f";[mix]volume={master_volume}[final]"

    command = ["ffmpeg", "-y"]
    command.extend(inputs)
    command.extend(["-filter_complex", filter_complex, "-map", "[final]", "-ar", "44100", "-ac", "2"])
    if output_format == "mp3":
        command.extend(["-codec:a", "libmp3lame", "-q:a", "2"])
    command.append(str(output_path))

    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=600)
        output = completed.stdout + "\n" + completed.stderr
        if completed.returncode == 0 and output_path.exists():
            update_job(
                job_id,
                status="succeeded",
                progress=100,
                result={
                    "engine": "audio-engine",
                    "output_file": str(output_path),
                    "filename": output_path.name,
                    "download_url": f"/files/{output_path.stem}",
                },
            )
        else:
            update_job(job_id, status="failed", progress=100, error=output[-3000:])
    except Exception as exc:
        update_job(job_id, status="failed", progress=100, error=str(exc))


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):  # type: ignore[no-untyped-def]
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
