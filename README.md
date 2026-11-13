# MUSTAPHA AUDIO STUDIO

**Working name.** A free, open-source digital audio and music production studio.

MUSTAPHA AUDIO STUDIO is an independent project focused on music generation, singing generation, voice cloning and conversion, stem separation, audio processing, mixing, and mastering.

This repository starts with Phase 1: study, architecture, licensing review, and planning. No production audio engine has been integrated yet.

## Core principles

- Free for users.
- Open-source first.
- No paid APIs or subscriptions.
- No credit systems.
- No fake audio results.
- No feature is presented as working until it is tested with real audio.
- Local-first processing; cloud GPU is optional, not guaranteed.
- Engine names are hidden from the public UI; engines run behind an internal Audio Engine layer.
- Every engine, model, and dataset must be reviewed for license compatibility before integration.

## Current phase

**Phase 1 — Study and foundation**

Deliverables:

- Project structure
- Engine comparison
- License matrix
- Hardware requirements
- Architecture notes
- Phase 2 execution plan

## Planned modules

- AI Music Composer
- Vocal Studio
- Voice Transformation
- Smart Stem Separation
- AI Singing
- Audio Mastering
- Sound Design
- Lyric Studio
- Project management and export

## Planned engine candidates

Primary candidates:

- ACE-Step 1.5 for music generation
- HeartMuLa for multilingual singing/music generation
- RVC for consent-based voice conversion
- Demucs / BS-RoFormer for development and stem separation
- FFmpeg for audio processing

Secondary or restricted candidates:

- YuE (original) for full-song generation
- MusicGen (non-commercial weights)
- YuE2 (non-commercial weights)

All candidates require license verification before integration.

## License

To be finalized after engine and weight license review. The project intends to use an open-source license compatible with its dependencies.

## Status

Phase 1 only. No engines are integrated yet. No audio generation has been tested. No deployment has been performed.
