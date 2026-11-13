# Architecture (Phase 1)

## Design goals

- Local-first audio processing.
- Web UI separated from heavy audio engines.
- Optional cloud GPU worker when available.
- Engine failures must not break the whole platform.
- Clear license tracking for every engine and model.
- No fake audio results.

## Proposed layers

1. **Frontend (web)**
   - User interface
   - Project management
   - Audio player and waveform display
   - Mixer and controls

2. **Backend API**
   - Project metadata
   - Job submission
   - Engine registry
   - Authentication and permissions

3. **Audio Engine**
   - Unified interface for all audio engines
   - Engine selection and fallback
   - Job execution

4. **Local Worker**
   - Runs heavy audio processing on the user's machine
   - Handles generation, conversion, separation, mastering

5. **Optional Cloud Worker**
   - Free GPU resources only
   - Not required for core functionality

6. **Storage**
   - Local project files
   - Audio assets
   - Engine outputs

## Engine registry

Each engine must record:

- Engine name
- Version
- Source URL
- License
- Model weights license
- Dataset license
- Hardware requirements
- Supported features
- Known limitations

## Audio Engine abstraction

The UI must not depend on engine names. Example internal interface:

```text
AudioEngine.generateMusic(request) -> job
AudioEngine.generateSinging(request) -> job
AudioEngine.convertVoice(request) -> job
AudioEngine.separateStems(request) -> job
AudioEngine.masterAudio(request) -> job
```

Engine-specific details remain in the engine adapter layer.
