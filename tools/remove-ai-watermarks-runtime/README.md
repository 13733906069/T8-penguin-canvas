This folder is the optional Electron sidecar runtime slot for the
`remove-ai-watermarks` CLI.

Keep large Python/Torch files out of git. For a self-contained user release,
place a prepared runtime here before packaging so electron-builder copies it to:

`resources/tools/remove-ai-watermarks`

Accepted shapes:

- `remove-ai-watermarks.exe`
- `Scripts/remove-ai-watermarks.exe`
- `python.exe` with `remove_ai_watermarks` installed
- `python/python.exe` with `remove_ai_watermarks` installed
- `.venv/Scripts/python.exe` with `remove_ai_watermarks` installed

If a Python entry and a CLI entry are both present, T8 probes the Python module
first with a lightweight import/version check. This keeps the packaged app from
misreporting "not installed" when the CLI cold-starts slowly in Torch/diffusers
environments.

Recommended manifest:

`runtime-manifest.json` with upstream commit/version, Python version, torch build,
CUDA build, and installed extras (`gpu`, `detect`, `trustmark`, `lama`, optional
`esrgan`).

Current bridge target:

- Upstream: `wiltodelta/remove-ai-watermarks`
- Version: `0.11.0` or newer for the current full UI
- Required CLI behavior: visible registry includes Gemini / Doubao / Jimeng /
  Samsung marks; invisible removal defaults to `--pipeline controlnet` and
  supports `--pipeline sdxl`, `--model`, `--guidance-scale`, `--upscaler`,
  `--min-resolution`, `--controlnet-scale`, `--adaptive-polish` /
  `--no-adaptive-polish`, and `--unsharp`; `all` mode runs visible + invisible
  + metadata and fails loudly when GPU deps are missing.
- Metadata mode is expected to handle image/video/audio containers, including
  HEIC, HEIF, JXL, Matroska audio, OGA, and Opus where the upstream package and
  local codecs support them.
- The current upstream no longer ships a face-restore extra. Do not prepare
  GFPGAN/restore runtime pieces for new packages.
  T8 still keeps a version-aware compatibility path for old 0.8.7 runtimes
  (`ctrlregen` / `--protect-text` / `--protect-faces`) and old 0.8.9 runtimes
  (`--auto` / `--restore-faces`), but release packages should be rebuilt on
  0.11.0+ so the UI matches the bundled CLI.
- Rebuild this sidecar whenever upstream changes CLI options, mark registry,
  optional extras, or model cache layout.
