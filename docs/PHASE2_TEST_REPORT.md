# PHASE2_TEST_REPORT.md

**Project:** MUSTAPHA AUDIO STUDIO  
**Phase:** Phase 2 — Proof of Operation  
**Date:** 2026-11-13  
**Mode:** Real engine tests on a local Windows machine. No paid services were used.

## 1. Environment

- OS: Windows
- Python: 3.10.11 (ACE-Step venv uses Python 3.11.14)
- GPU: AMD Radeon integrated graphics only; no NVIDIA GPU detected
- PyTorch: CPU build (`torch 2.7.1+cu128` installed by ACE-Step, but `torch.cuda.is_available() = False`)
- FFmpeg: available
- Free disk space: ~134 GB
- Checkpoints size after download: ~9.4 GB
- Output size: ~26.6 MB

## 2. ACE-Step 1.5 — Music Generation

### Installation

- Cloned `ACE-Step/ACE-Step-1.5`.
- Installed dependencies with `uv sync`.
- Dependencies installed: 125 packages.
- Main model downloaded automatically from Hugging Face: `ACE-Step/Ace-Step1.5`.

### Test 1 — Raï-style instrumental

- Prompt: `Raï algérien moderne, rythme entraînant, guitare, derbouka, ambiance festive, voix masculine arabe, tempo 120 BPM`
- Lyrics: instrumental
- Duration requested: 20 seconds
- Inference steps: 4
- Device: CPU
- Result: **SUCCESS**
- Elapsed time: 113.4 seconds
- Output file: `engines/ace-step/ACE-Step-1.5/output/phase2_test/3f7a21cc-92ca-8d40-c83f-a592ba142300.wav`
- Format: WAV, 48 kHz
- File size: 7,680,088 bytes

### Test 2 — Arabic vocal

- Prompt: `Arabic pop, male vocals, emotional, 110 BPM`
- Lyrics: Arabic (`يا ليل يا ليل`)
- Duration requested: 15 seconds
- Inference steps: 4
- Device: CPU
- Result: **SUCCESS**
- Elapsed time: 91.6 seconds
- Output file: `engines/ace-step/ACE-Step-1.5/output/phase2_arabic_vocal/d2bdbb25-e037-0627-58f8-3f98847d4051.wav`
- Format: WAV, 48 kHz
- File size: 5,760,088 bytes

### ACE-Step license notes

- Repository code license: MIT
- Model weights: downloaded from Hugging Face (`ACE-Step/Ace-Step1.5`)
- The repository states MIT licensing, but checkpoint and weight usage terms must be verified before public/commercial use.
- No commercial-use claim is made until the checkpoint license is explicitly confirmed.

## 3. Stem Separation — Demucs

### Test

- Engine: Demucs `htdemucs`
- Input: ACE-Step generated 20-second WAV
- Device: CPU
- Result: **SUCCESS**
- Elapsed time: approximately 13 seconds
- Output files:
  - `vocals.wav` (3,528,044 bytes)
  - `drums.wav` (3,528,044 bytes)
  - `bass.wav` (3,528,044 bytes)
  - `other.wav` (3,528,044 bytes)

### License notes

- Demucs code license: MIT
- Model weights: trained partly on MUSDB18-HQ, which has non-commercial restrictions
- **Not approved for public/commercial use** until weight license is verified

## 4. Audio Processing — FFmpeg

### Test

- Input: ACE-Step generated 20-second WAV
- Operation: loudness normalization to -16 LUFS, 44.1 kHz stereo MP3
- Result: **SUCCESS**
- Output file: `engines/ace-step/ACE-Step-1.5/output/processing/normalized.mp3`
- File size: 320,826 bytes
- Processing speed: ~22x real-time

### License notes

- FFmpeg is available under LGPL/GPL depending on build.
- Use a build compatible with the intended distribution model.

## 5. Voice Conversion / Voice Cloning

### Status

- **Not tested.**
- RVC code is MIT-licensed.
- Pretrained weights and dataset licenses require verification.
- Voice cloning requires explicit consent and must not be used to impersonate real people.
- No RVC model was downloaded or executed in this phase.

### Proposed next test

- Clone RVC repository.
- Verify pretrained model licenses.
- Test voice conversion with a user-owned reference voice only.
- Measure quality, latency, and VRAM usage.

## 6. HeartMuLa

### Status

- **Not tested.**
- Repository license: Apache 2.0
- Reported to support multilingual music and singing generation.
- Requires more VRAM than ACE-Step (likely 8–12 GB).
- No model was downloaded or executed in this phase.

## 7. YuE

### Status

- **Not tested.**
- Original YuE: Apache 2.0
- YuE2: CC BY-NC 4.0 with additional creator permission
- High VRAM requirements (likely 24GB+)
- No model was downloaded or executed in this phase.

## 8. Resource usage

| Test | Device | Duration requested | Elapsed | Output |
|---|---|---:|---:|---|
| ACE-Step instrumental | CPU | 20s | 113.4s | 7.68 MB WAV |
| ACE-Step Arabic vocal | CPU | 15s | 91.6s | 5.76 MB WAV |
| Demucs separation | CPU | 20s input | ~13s | 4 stems, ~3.5 MB each |
| FFmpeg normalization | CPU | 20s input | <1s | 321 KB MP3 |

- No NVIDIA GPU was available.
- ACE-Step ran on CPU with offloading.
- Model download size: ~9.4 GB.
- RAM usage was not precisely measured; Windows reported near-zero delta due to offloading behavior.

## 9. Errors and limitations

- No NVIDIA GPU detected; all tests ran on CPU.
- ACE-Step LLM was not initialized in the CPU test, so metadata reasoning was disabled.
- ACE-Step `guidance_scale` was automatically overridden to `1.0` because turbo mode does not use CFG.
- Demucs emitted a symlink warning on Windows; processing still succeeded.
- RVC, HeartMuLa, and YuE were not tested.
- No UI was built in this phase.
- No audio quality scoring was performed yet.

## 10. License summary

| Engine | Code license | Weights/data license | Commercial use status |
|---|---|---|---|
| ACE-Step 1.5 | MIT | Verify checkpoint license | Pending verification |
| Demucs | MIT | MUSDB18-HQ (non-commercial) | Not approved |
| FFmpeg | LGPL/GPL (build-dependent) | N/A | Yes, with obligations |
| RVC | MIT | Verify | Pending verification |
| HeartMuLa | Apache 2.0 | Apache 2.0 (reported) | Pending verification |
| YuE (original) | Apache 2.0 | Apache 2.0 (reported) | Pending verification |
| YuE2 | Apache 2.0 (code) | CC BY-NC 4.0 | Not approved |
| MusicGen | MIT | CC-BY-NC 4.0 | Not approved |

## 11. Phase 2 conclusion

Phase 2 achieved a real, reproducible proof of operation:

1. ACE-Step 1.5 generated real audio on CPU.
2. Arabic vocal generation succeeded.
3. Demucs separated a real generated song into stems.
4. FFmpeg processed and exported audio.
5. All outputs were saved and can be reopened.

The project is ready to proceed to Phase 3 (studio build) only after your review and approval of these results and the license constraints.
