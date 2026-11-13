# License Matrix (Phase 1)

This document is a preliminary review and must be verified before integration.

| Engine | Code license | Weights / data license | Commercial use | Notes |
|---|---|---|---|---|
| ACE-Step 1.5 | MIT | Verify checkpoint license | Likely yes, verify | Primary music generation candidate |
| ACE-Step v1 | Apache 2.0 | Verify | Likely yes, verify | Older version |
| HeartMuLa | Apache 2.0 | Apache 2.0 (reported) | Likely yes, verify | Multilingual singing |
| YuE (original) | Apache 2.0 | Apache 2.0 (reported) | Likely yes, verify | High VRAM |
| YuE2 | Apache 2.0 (code) | CC BY-NC 4.0 + creator permission | No | Avoid for public/commercial use |
| MusicGen | MIT | CC-BY-NC 4.0 | No | Avoid for public/commercial use |
| RVC | MIT | Verify pretrained weights | Uncertain | Consent-based voice use only |
| Applio | Verify | Verify | Uncertain | UI/tooling around RVC |
| Demucs | MIT | MUSDB18-HQ (non-commercial) | Uncertain | Verify before public release |
| BS-RoFormer | MIT | MUSDB18-HQ (non-commercial) | Uncertain | Verify before public release |
| FFmpeg | LGPL/GPL (build-dependent) | N/A | Yes, with obligations | Use appropriate build |
| Web Audio API | Web standard | N/A | Yes | Browser-side processing |

## Rules

1. Code license and model weight license are separate.
2. No engine may be integrated before license verification.
3. No pretrained voice model may be used without consent verification.
4. Non-commercial weights must not be used in a public commercial-capable platform.
5. License information must be recorded in the engine registry.
