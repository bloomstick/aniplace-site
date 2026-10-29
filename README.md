# Aniplace landing — apps/animedream/site (ani.place)

Static landing, no build step. The monorepo is the source; the published
mirror is the GitHub Pages repo `bloomstick/aniplace-site` (see [Deploy](#deploy)).

| File | Purpose |
|---|---|
| `index.html` | Main landing (hero, stats, screenshot slider, features, download + QR, catalog picks, FAQ) |
| `install.html` | Install guide: RuStore first, then the APK path, then Windows; linked from the direct-download button |
| `styles.css` | Palette, layout, responsive rules, the screenshot slider, reduced-motion handling |
| `app.js` | three.js hero (floating hearts, parallax, click bursts) + screenshot slider + scroll reveal + counters |
| `download.js` | Platform-aware CTAs: resolves the current release files and explains the platform's build |
| `assets/` | `logo.png`, `favicon.png`, `mascot.png`, `poster-dream.webp`, `mio.webp`, `banner-hero.png`, `group-greeting.png`; `shots/` (six app-UI crops); `qr-install.svg`, `og-cover.png` (generated) |

## Palette

The site follows the app's brand tokens — `apps/animedream/lib/src/brand/
aniplace_brand.dart` is the source of truth:

| Token | Value | Role |
| --- | --- | --- |
| `--accent` | `#e11d48` | `kAniplaceActionRed`: buttons, links, highlights |
| `--accent-deep` | `#be123c` | hover/pressed, small text links |
| `--ink` / `--ink-soft` | `#1f2328` / `#5f6368` | text on light (`#5f6368` is `kAniplaceSeed`) |
| `--ground` / `--card` | `#f6f7f8` / `#ffffff` | page ground and cards |
| `--line` | `#dadce0` | borders |
| `--footer` | `#202124` | footer/marquee ground |

Change a colour in both places or the site and the app drift apart. The
old pink family (`#ff3d5e` / cream / maroon footer) is gone; the three.js
palette in `app.js` carries the same graphite + signal-red set.

## Platform-aware downloads (`download.js`)

Markup stays static and working without JS; the script only upgrades it:

- `data-dl="primary"` / `"bar"` / `"footer-android"` → the current Android APK.
- `data-dl="windows"` / `"footer-windows"` → the current Windows `.zip` (portable, contains `Aniplace.exe`).
- `data-dl="meta"` → the platform note paragraph (hidden until filled, so the page never shows a wrong guess).

Platforms: Android gets the APK as its primary CTA; Windows keeps Android
as the *main* offer (framed for the phone and paired with the QR) with the
Windows build beside it; iOS/macOS/Linux get an honest note instead of an
unusable file. Release filenames carry the version, so the current asset is
resolved from the releases hub at load (cached in `sessionStorage` for
30 min) with `FALLBACK` last-known-good direct links for when the API is
rate-limited or unreachable — **bump `FALLBACK` whenever a release rotates
the filenames.**

## Generated assets

```powershell
python apps/animedream/tools/site/make_qr.py     # assets/qr-install.svg
python apps/animedream/tools/site/make_og.py     # assets/og-cover.png (1200x630)
python apps/animedream/tools/site/make_app_shots.py   # assets/shots/app-*.webp (720x1280)
```

The QR points at `https://ani.place/install.html` (the site's own download
guide), so scanning from a phone and clicking from a desktop land in the
same place. It needs `qrcode` (pure Python).

The share card is what `og:image` / `twitter:image` point at. It is built
from the 1024 app icon, the catalog frame and the landing palette; the
Nunito font is downloaded to `tools/site/.assets` on first run (Pillow
required). Re-run it after a palette or hero-art change.

## Screenshots

`assets/shots/app-*.webp` are 720×1280 perspective crops of the phone
screen from the six committed RuStore frames
(`apps/animedream/docs/store/rustore/01-catalog.png` … `06-search.png`).
The full frames are 1080×1920 marketing cards with a headline above the
phone; they stay in `docs/store/` as the only real captures, while the
site ships only the app-UI crops (about 0.5 MB for the set, all
`loading="lazy"`). Regenerate them with `make_app_shots.py`; the quad is
fixed to the store mockup's -7.5° phone.

The gallery on the landing is a horizontal scroll-snap strip, not a grid:
one large card (`min(72vw, 330px)` wide) at a time. Touch and trackpad swipe
and the focused strip's arrow keys work with no JavaScript; `app.js` adds
the arrow buttons, page dots and `Home`/`End`, and turns `scroll-behavior`
off under `prefers-reduced-motion`.

## Pending

- `install.html`'s OS-level callouts (the system "Установить приложение?"
  dialog, the unknown-sources toggle, Windows SmartScreen) are still styled
  text: no such captures exist in the repo. Real photos replace them when
  taken.
- `assets/banner-hero.png` and `group-greeting.png` are the pre-rebrand
  banner art (the anime-group illustration), kept as source art; neither
  page nor the share card uses them today.

## Deploy

`ani.place` is GitHub Pages from **`bloomstick/aniplace-site`** (source:
`main` / root, `CNAME` = `ani.place`). Copy this folder over a checkout of
that repo, keep its `CNAME`, then commit and push:

```powershell
Copy-Item apps/animedream/site/* <aniplace-site>\ -Recurse -Force
# keep <aniplace-site>\CNAME untouched
git -C <aniplace-site> add -A
git -C <aniplace-site> commit -m "Deploy site from dream-monorepo"
git -C <aniplace-site> push origin main
```

Pages rebuilds in about a minute; `index.html`, `install.html`, `assets/`
and both scripts are served as-is. Do not edit the Pages repo by hand — the
monorepo copy is the source of truth.

## Local preview

```powershell
cd apps/animedream/site
python -m http.server 8000
# open http://localhost:8000/
```
