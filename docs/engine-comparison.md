# Engine Comparison (Phase 1)

| Category | Primary candidate | Secondary candidate | Notes |
|---|---|---|---|
| Music generation | ACE-Step 1.5 | HeartMuLa, YuE (original) | ACE-Step 1.5 reported to run on low VRAM |
| Singing generation | HeartMuLa | YuE (original) | Multilingual support |
| Voice conversion | RVC | Applio | Consent required |
| Stem separation | Demucs (development) | BS-RoFormer | Weight license must be verified |
| Audio processing | FFmpeg + Web Audio API | Python DSP libraries | Local-first |
| Mixing / mastering | Custom DSP pipeline | Open-source plugins | To be designed |
| MIDI / Piano Roll | To be evaluated | JUCE alternatives | JUCE is not fully open source |

## Hardware expectations

| Engine | GPU | RAM | Storage |
|---|---|---|---|
| ACE-Step 1.5 | <4GB VRAM reported | 16GB+ | 10GB+ |
| HeartMuLa 3B | 8-12GB VRAM likely | 32GB+ | 15GB+ |
| YuE | 24GB+ VRAM likely | 32GB+ | 20GB+ |
| Demucs | CPU possible, GPU faster | 16GB+ | 5GB+ |
| BS-RoFormer | CPU possible, GPU faster | 16GB+ | 5GB+ |
| RVC training | GPU recommended | 16GB+ | 10GB+ |
| RVC inference | CPU possible | 8GB+ | 5GB+ |

All hardware figures are preliminary and must be tested.
