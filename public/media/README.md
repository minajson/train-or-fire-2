# Media

`machine-failure.mp4` — the footage the incident screen opens on.

The incident stage shows it when it is present and draws its animated schematic
when it is not. Nothing breaks either way.

See `docs/MACHINE_FAILURE_VIDEO_PROMPT.md` for the generation prompt, the
constraints the clip has to respect, and the ffmpeg command to encode a
replacement for delivery. Do not commit a generator's raw export: strip the
audio and the cover-art stream and re-encode first, or every projector
downloads several megabytes it will never use.
