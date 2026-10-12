# Aniplace landing — apps/animedream/site (ani.place)

Static landing, no build step. Deploy the folder as-is to `ani.place`.

| File | Purpose |
|---|---|
| `index.html` | Main landing (hero, stats, screenshots, features, download, trending, FAQ) |
| `install.html` | Install guide: Android APK + Windows, linked from the direct-download button |
| `styles.css` | Cute bright light theme, primary warm pink-red `#ff3d5e → #e11d48` |
| `app.js` | three.js interactive hero (floating hearts, parallax, click bursts) + scroll reveal + counters |
| `assets/` | `mascot.png` (local art pipeline, animagine-xl-4.0), `poster-dream.webp` + `mio.webp` (noveldream), logo pending (🌸 placeholder) |

Mascot gen provenance (`C:\my\projects\art-pipeline\gen.py`, ComfyUI 0.38.0):
`--ckpt animagine-xl-4.0.safetensors --steps 24 --cfg 5 --w 1024 --h 1024 --seed 77`,
prompt «cute anime mascot girl with pink hair, warm coral-red oversized hoodie
with cat ears, happily waving hello, holding a smartphone, kawaii pastel sticker
illustration…», downscaled to 600px via Pillow.

## three.js highlight

`#sparkles` canvas in the hero renders floating 3D hearts + sparkle particles
(three.js 0.160 via CDN, UMD + ESM fallback). Pointer moves the camera,
clicks burst new hearts. Respects `prefers-reduced-motion`; page works offline
without CDN (static content + CSS animations remain).

## Download wiring

- Direct download button → `install.html` (meticulous steps + SHA-256 note).
- GitHub button → https://github.com/bloomstick/aniplace-releases/releases/latest
- RuStore button → disabled placeholder until the store link exists.
- `install.html` step illustrations are styled text callouts — replace with real
  device screenshots before public launch.

## Local preview

```powershell
cd apps/animedream/site
python -m http.server 8000
# open http://localhost:8000/
```
