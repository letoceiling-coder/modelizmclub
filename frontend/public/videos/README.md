# Hero videos

Landing hero reads `media_url` from the hero landing block (default `/videos/herovideo.mp4`).

Files in this folder:

- `herovideo.mp4` — H.264, FastStart (`moov` atom at the beginning) for web buffering
- `herovideo.webm` — VP9 fallback; the hero `<video>` picks it first when the mp4 URL is used

The player mounts only after first paint / `requestIdleCallback`, with `preload="none"`, so the file does not block DOM or abort on SPA navigation. Poster fallback: `src/assets/cover-modelizm.jpg`.
