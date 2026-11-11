# place family hub — apps/animedream/site (ani.place)

Static family hub for **Aniplace** and **Mangaplace**, no build step. The
monorepo is the source; the published mirror is the GitHub Pages repo
`bloomstick/aniplace-site` (see [Deploy](#deploy)).

Russian only for v1. The two products share one page: a warm paper zine
hosted by the pink fox mascot, two asymmetric “rooms”, the original straight
Aniplace screenshots in a contact sheet, an interactive install guide and
GitHub-first release links.

| File | Purpose |
|---|---|
| `index.html` | Family landing: mascot hero, Aniplace / Mangaplace rooms, screenshot contact sheet, install teaser, release ledger, FAQ |
| `install.html` | Three-stage install wizard (app → device → exact guide), plus a static no-JS fallback |
| `changelog.html` | «Что нового»: ruled history of Aniplace / Mangaplace releases from GitHub, with a static no-JS fallback and both GitHub release links |
| `styles.css` | Paper palette, zine layout, sticker/tape details, wizard, responsive rules, reduced-motion handling |
| `changelog.css` | Changelog-only timeline, version entries, release-note typography, empty/failed states |
| `app.js` | Header, mobile menu, seamless marquee, screenshot rail, lightbox, scroll reveals |
| `install.js` | App/device choice, URL deep links, release-aware result, copy-to-clipboard, wizard navigation |
| `changelog.js` | GitHub changelog resolver, 30-minute session cache, safe Markdown renderer for untrusted release bodies |
| `download.js` | S3-first download resolver for both apps (GitHub fallback); fills version/date/size/SHA links and flips Mangaplace from “soon” to real buttons |
| `campaign/` | Aniplace-only ad landing (`index.html`, `campaign.css`, `campaign.js`, `og-campaign.png`): animated midnight hero, design-concept screens, Android-first direct APK / RuStore CTAs, desktop QR, optional Windows install, dedicated share card |
| `go/` | RuStore-free copy of the ad landing (`index.html`, `go.css`, `go.js`, `og-go.png`): same midnight hero and direct-APK flow as `campaign/`, no store mentions or buttons |
| `assets/` | `mascot.png` (source art) + `mascot.webp` / `mascot-360.webp`, both app icons, `favicon.png`, `grain.png` (texture); `shots/` (six straight Aniplace screens, 720×1384); `qr-install.svg`, `og-cover.png` (generated) |

## Campaign landing (`campaign/`)

Aniplace-only conversion page for paid traffic: **https://ani.place/campaign/**.
One job: install the app on Android. The primary CTA is always the signed
Android APK served directly from the GitHub release, on every platform;
RuStore is the secondary path (hidden only on iOS). Desktop shows a QR to the
live Android install wizard; Windows is an optional `<details>` block with
its setup steps, never the primary CTA. iPhone/iPad get an honest no-build
note and no store link.

| File | Purpose |
|---|---|
| `campaign/index.html` | Campaign page: hero, design-concept screens, features, Android install, optional Windows details, FAQ, final CTA |
| `campaign/campaign.css` | Source for the midnight-poster design, 3D phone stack, aurora, marquee, rail progress, responsive and reduced-motion rules |
| `campaign/campaign.js` | Source for Android-primary release links, counters, reveals, parallax/tilt, screenshot rail, lightbox, sticky bar |
| `campaign/campaign.min.css`, `campaign/campaign.min.js` | Generated minified assets served by the page; edit the source files above, then regenerate with `npx --yes esbuild … --minify` |
| `campaign/fonts/` | Self-hosted Caveat, Manrope and Unbounded variable faces for Cyrillic, Latin and Latin-ext; Unbounded Cyrillic is the only preloaded face |
| `campaign/mockups/` | Eight optimized design-concept screens: seven 720×1558 phone screens and a 900×595 Windows screen, plus committed 320/480-wide WebP renditions (and a 720-wide Windows copy) selected with `srcset` |
| `campaign/qr-android.svg` | Generated QR to `https://ani.place/install.html?app=aniplace&os=android`, shown on desktop |

**Design.** A midnight screening poster rather than a second copy of the paper
hub: deep plum ground, signal red/pink light, Unbounded headlines, the
cozy-modern design-concept screens as the product imagery, and the fox mascot
as host. The page labels them «макеты»; they are a design direction, not
shipped-app captures. Motion is CSS-first; `campaign.js` adds only pointer
parallax, tilt, scroll reveals and the rail. `prefers-reduced-motion` disables
all of it.

**CTA contract.** Every download link is a real `<a>` in the HTML, so the page
works before the script. `data-dl-primary` links start at the last known-good
direct asset (v1.24.1 APK) and are then upgraded to the newest build: S3 first
(`<S3_BASE>aniplace/latest.js`, published by the admin panel's **Downloads**
screen and loaded with a script tag, so no CORS is involved), GitHub second
(`ani.campaign.release.v3`, 10-minute session cache, 8s timeout). When S3 has no manifest and the GitHub API is rate-limited or
unreachable, the same fallback is painted and cached; bump `FALLBACK` in
`campaign.js` when release filenames rotate. `data-dl-label`,
`data-dl-meta`, `data-dl-size`, `data-version`, `data-sha-link`,
`data-dl-windows` and `data-release-link` are filled from the resolved release.
`data-dl-primary` always resolves to the Android APK; it never switches to
Windows. A normal click starts that file in a hidden frame and then opens the
install wizard's result step at `/install?app=aniplace&os=android&step=3&started=1`
(`install/index.html` forwards to `install.html`), where the instructions and
the «Скачивание началось» note live; modifier clicks keep the browser's own
behaviour. `data-platform` on `<html>` handles visibility only: RuStore CTAs
(`data-android-only`) hide on iOS, the optional Windows `<details>`
(`data-windows-optional`) hides on Android/iOS, and the QR card shows on
desktop. The Android steps stay the no-JS default because Android is the
campaign's primary path.

**Assets.** Product imagery comes from `campaign/mockups/`: seven 720×1558
phone screens and one 900×595 Windows screen optimized from
`docs/static/design/aniplace-cozy-modern/`. The family hub keeps its own
straight `../assets/shots/` captures. The campaign also reuses the mascot, app
icon and grain from `../assets/`. Relative links reach the hub, changelog and
privacy page; GitHub/RuStore destinations are absolute. There is no build step. Campaign mockups are screen-only exports: the
design concept's numbered presentation pins and baked phone bezel are
intentionally absent, so the page draws one frame around each screen.
`campaign/qr-android.svg` is generated by
`python apps/animedream/tools/site/make_campaign_qr.py`; it points at the live
Android install wizard, so the QR remains useful before the campaign itself is
published. Re-run it only if that URL moves.

**Share card.** `campaign/og-campaign.png` (1200×630) is generated from the
real mascot, catalog/title screens, app icon, grain and the app's own
Unbounded/Manrope variable fonts by
`python apps/animedream/tools/site/make_campaign_og.py`. `og:image`,
`og:image:secure_url`, `twitter:image` and the JSON-LD `image` point at it;
re-run the script after brand art or headline changes. The sibling hub pages
keep the family `assets/og-cover.png` card.

## Go landing (`go/`)

RuStore-free copy of the campaign page for paid traffic:
**https://ani.place/go/**. Same midnight-poster design, same conversion job
(direct Android APK install), same CTA contract, same tooling — but no store
mentions anywhere: no RuStore buttons, no `data-android-only` hooks, no store
wording in meta/OG/FAQ copy, and the share card footer reads `ani.place/go`.
The page is a full copy, not a skin: `go/index.html`, `go/go.css`,
`go/go.js` (session cache key `ani.go.release.v1`), `go/go.min.css`,
`go/go.min.js`, plus its own `go/fonts/`, `go/mockups/`,
`go/qr-android.svg` and `go/og-go.png`. The generator scripts emit both
variants in one run (`make_campaign_og.py`, `make_campaign_qr.py`,
`make_campaign_screens.py`); keep `campaign/` and `go/` in step when the
design or copy changes.

**Local preview.** From `apps/animedream/site`: `python -m http.server 8000`,
then open `http://localhost:8000/campaign/` or `http://localhost:8000/go/`.

**Telegram Mini App** (`go/tg.js` + `go/tg.min.js`, built with esbuild
like the rest). Outside Telegram the file returns before loading
anything, so browser visitors pay zero extra requests and the page
behaves exactly as above. Inside Telegram (the `tgWebApp*` query
Telegram appends, or the Telegram UA) it loads `telegram-web-app.js`
and: `ready()` + `expand()`, header/background `#0b0810`; every
`[data-dl-primary]` tap first tries the direct send — `POST
{initData}` to `DL_ENDPOINT` (top of `tg.js`, empty by default), where
the bot (`POST /api/dl`, see `tools/telegram-bot/`) HMAC-validates the
user and drops the cached APK straight into their chat, no START
needed. This is the only path that works for returning users: a
`t.me/bot?start=` link delivers its payload solely on the very first
START, so their taps would otherwise reach no bot-side event at all.
On `{ok:true}` the page shows «Файл уже в чате» and closes itself.
Anything else (no endpoint configured, network failure, `need_start`
for first-timers, no cached build) falls back to opening
`https://t.me/aniplacebot?start=apk_<version>` via
`Telegram.WebApp.openTelegramLink` with an «отправь туда /start» note —
and bare `/start` answers with the welcome plus the latest build, so
the fallback lands for everyone. Either way the QR card and the
Windows block hide and `go.js` yields via `window.__aniTgMode`.

`BOT_USERNAME` at the top of `tg.js` must match the BotFather username
and `BOT_USERNAME` in the bot backend's `bot.env`; `DL_ENDPOINT` needs
a public HTTPS URL of the bot's `--pair-port` (VPS, or a tunnel for a
local PC, e.g. `cloudflared tunnel --url http://localhost:8087` —
`http://` LAN URLs are blocked as mixed content from the `https://`
page). Change constants, rebuild `tg.min.js`.

**BotFather setup** (operator, once): `/newbot` (username
`@aniplacebot`) → `/newapp` → attach to the bot, URL
`https://ani.place/go/`, short name e.g. `go`. Telegram links the app
as `t.me/aniplacebot/go`; promoting that link (channel post, Telegram
Ads) opens the landing inside Telegram with the bot one tap away. The
bot process must be running (`tools/telegram-bot/run.cmd`) or taps
land in an empty chat.

**Deploy.** Same as the hub (copy this folder over `bloomstick/aniplace-site`,
keep `CNAME`, commit, push). The campaign is a subfolder, so it publishes at
`ani.place/campaign/` with the hub untouched.

## Design intent

The direction is **a handmade zine for two apps**, not a dark SaaS landing:

- The mascot is the host: a sticker sheet on the hero, taped to the page,
  with a speech bubble. She is the reason the page has a face; keep her
  singular. Do not add a second character or wallpaper the page with art.
- The paper is cream, the ink is warm near-black, and the accent is the app
  red. Pink and butter are small, physical accents (tape, stamps, checkmarks),
  never large gradients.
- The hero pairs the mascot with one real catalog screen in a straight frame.
  “Место” is the red word with a hand-drawn underline; the old handmade
  greeting becomes a Caveat note (“заходи, тут уютно”).
- Aniplace and Mangaplace are two rooms on the page, not tabs. Aniplace is a
  red-headed white room with a real title-page screen; Mangaplace is a navy
  cover with a centred “soon” story and an M watermark. The asymmetry is
  intentional: one app is alive, the other is honestly not.
- Screenshots are a manga contact sheet: numbered frames, page-sheet border,
  a washi-tape corner, arrows and an `01 / 06` counter. The selected frame
  gets a red frame and red shadow, so the arrows still read as progress when
  the remaining frames are already visible. No dots, no carousel chrome, no
  “листай свайпом” explanation.
- Installation is a short three-step tease on the landing; `install.html` is
  the real app/device wizard with Android unknown-sources and Windows
  SmartScreen branches, an optional file check and a “stuck?” decision tree.
- Releases are a ledger table, not two cards. Aniplace is live; Mangaplace’s
  row and room flip from “soon” to real buttons when a release appears.
- The changelog is the same ledger continued as a ruled history: a version
  timeline per app, the latest entry open, older entries folded into
  `<details>`, and release notes set as editorial copy rather than a card grid.
- The FAQ is an editorial two-column list; the footer is a colophon with a
  “продолжение следует” note.

Keep the page free of the old template tells: numbered eyebrow labels,
identical section rhythm, equal product cards with tabs, a dots carousel,
a three-column trust row, neon glows and glass blur.

## Palette & type

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#fdf4ec` | main ground, matches the mascot sheet |
| `--paper-2` | `#f7e9dc` | screenshot / release bands |
| `--ink` | `#2a2027` | text, borders, footer ground |
| `--red` | `#e11d48` | Aniplace actions, stamps, checks |
| `--red-deep` | `#b0133a` | small red text on paper |
| `--navy` | `#202a4a` | Mangaplace room |
| `--pink` | `#ffb6cf` | tape, footer links, selection |
| `--butter` | `#ffe4a3` | Mangaplace stamps and checks |
| `--ink-soft` | `#6d5a63` | secondary copy on paper |

- Display: **Unbounded** (500–800) — headlines, versions, step numbers.
- Body/UI: **Manrope** (400–800) — copy, controls, navigation.
- Hand: **Caveat** (500–600) — margin notes, mascot caption, footer sign-off.
  Use it for a few short lines only; it is a spice, not body copy.
- The three families are self-hosted as subset `woff2` files under
  `campaign/fonts/` (`unicode-range` split per face); there is no Google Fonts
  request, and the page must remain readable with the system fallback.

The red and navy are the app brands; keep them in step with
`apps/animedream/lib/src/brand/aniplace_brand.dart` and the Mangaplace
lockup. The old three.js hero is gone; the page is CSS + small vanilla
scripts.

## Download resolution (`download.js`)

Every download CTA is a normal link in the HTML, so the page works before
the script runs. The script upgrades those links in this order:

1. **S3 latest** — `<S3_BASE><app>/latest.js`, written by the admin panel's
   **Downloads** screen and loaded with a `<script>` tag into
   `window.__aniLatest[<app>]`. A publish overwrites the stable names and
   deletes every older object under that app prefix, so the script always
   describes the one current build; `latest.json` carries the same data for
   tooling. `S3_BASE` in `download.js` and `campaign.js` must match
   `releases_public_base_url` in
   `repo/tools/cover_thumbs/config/upload.json`.
2. **GitHub** — only when S3 has no usable manifest (404, bad body or a
   network error). Aniplace hub: `bloomstick/aniplace-releases`; Mangaplace
   hub: `moeplace/mangaplace-releases`.
- Cached in `sessionStorage` for 30 minutes after either source resolves;
  8-second timeout per request. The key was bumped to `v3` so a cached
  GitHub-only resolution cannot outlive the S3 rollout.
- The bucket does **not** need CORS: `latest.js` is loaded as a script, which
  browsers do not subject to the cross-origin fetch rules. `latest.json` is
  still published for tooling and for any client that fetches it; those
  readers need the usual `Access-Control-Allow-Origin`.
- On API failure, Aniplace falls back to the last known-good versioned
  direct links in `FALLBACK` (bump these when a release rotates filenames).
  The fallback is cached too, so a rate-limited IP does not hammer the API.
- Mangaplace stays **soon** until a release with an APK or Windows asset
  exists, then the room, the ledger row and the wizard flip to real buttons
  automatically. No code change is needed on the first Mangaplace release.

`data-dl-app` + `data-dl-os` are the CTA contract; `data-release-app` +
`data-release-field` fill version, date, sizes, release URL, SHA URL and
watch URL. `<html data-platform>` carries the detected OS (the early inline
script sets `android` before the stylesheet so Windows offers never flash
on a phone).

- `data-dl-icon` swaps the CTA glyph to the target platform
  (`i-android` / `i-windows`; generic download when there is no direct file).
- `data-dl-ready="1"` marks a CTA with a real asset. A normal click opens
  that file in a separate tab and opens
  `install.html?app=…&os=…&step=3&started=1`; the result shows the
  “Скачивание началось. Не скачивается? Повторить” note as a full-width
  strip directly above the wizard card. Opening the guide
  in the current tab must never cancel the attachment, which is why the file
  gets its own tab. If the popup is blocked, a hidden frame starts the file
  before the guide navigation.
- The install result and retry are normal `target="_blank"` links; they
  reveal the started note and let the browser start the file in a new tab.
  Modifier clicks keep the browser’s own behaviour.
- On Android the landing hides every Windows file/offer and the wizard skips
  the device step; desktop (Windows/macOS/Linux) keeps the Android/Windows
  choice. `data-os-only="windows"` and `data-dl-platform="windows"` are the
  CSS hooks.

**Windows asset matching:** the resolver accepts both
`*-windows-setup.exe` and `*-windows.zip`, because the release pipeline has
shipped both. The UI labels the asset by `kind`; keep the install copy
generic enough for either.

## Changelog page (`changelog.html`)

The «Что нового» page is a public, Russian-only history of versions. It is
static HTML plus `changelog.js`; there is no build step.

- **Source:** exactly two GitHub endpoints, both with `per_page=10`:
  `bloomstick/aniplace-releases` and `moeplace/mangaplace-releases`. The
  request sends `Accept: application/vnd.github+json` and aborts after 8s.
  Drafts and prereleases are skipped; the remaining releases are sorted
  newest-first.
- **Cache:** parsed releases live in `sessionStorage` under
  `place.changelog.v1` for 30 minutes. This is a separate key from
  `download.js` (`place.releases.v3`), so the two features cannot poison
  each other. Failures are not cached, so the next visit can retry.
- **Fallback:** the source note and both GitHub release links are static
  HTML, and a `<noscript>` note points no-JS visitors at both release
  feeds. A failed or rate-limited API renders a compact per-app “GitHub не
  ответил” state with its own release link — never an empty page or an
  error wall. Mangaplace with no public releases says so honestly and
  links to its GitHub releases.
- **Safe Markdown:** release bodies are untrusted. `renderMarkdown()`
  escapes the entire body first, then adds only its own markup for ATX
  headings, paragraphs, unordered/ordered lists, bold, italic, inline
  code, http(s) links, fenced code and line breaks. Raw HTML is never
  parsed; link URLs are restricted to `http:`/`https:` and normalized with
  `new URL()`. The release link itself only accepts `https://github.com/…`
  and otherwise falls back to the app’s releases page. Keep this order if
  the renderer changes.
- **Header download:** the page deliberately uses a plain `install.html`
  link, not the `data-dl` hook. It therefore does not load `download.js`
  and makes no extra API calls; platform-aware direct downloads remain on
  the landing and install pages. `app.js` is included so the mobile menu
  and scroll reveals work.
- **Footer:** «Что нового» sits in the «Ещё» column on `index.html`,
  `install.html` and the page itself; the current page carries
  `aria-current="page"`. The footer app icons link back to their rooms.

## Install wizard (`install.js`)

- Query contract: `install.html?app=aniplace&os=android`. Both params deep-link
  straight to step 3, which is what shared links use. The wizard also writes
  `&step=N`, so a refresh keeps the stage the visitor was on instead of
  jumping to the finished guide. A landing CTA adds `&started=1`; the result
  then shows the download-started strip above the wizard and the retry link.
  The wizard scroll keeps that strip in view when it appears.
- On Android the device step is removed: the progress becomes
  `01 Приложение` / `02 Инструкция`, the result is always the APK, and the
  header download always targets Android. On desktop the three-stage flow
  (app / device / guide) stays.
- `app=mangaplace` is selectable and explains the coming-soon state; it does
  not pretend a build exists.
- The result header, file name, size, download target, SHA link and checksum
  command all follow the selected app/device and the resolved release.
- Android + Aniplace results also show the “Или из RuStore” link; Windows
  hides it.
- Copy buttons use the Clipboard API with an `execCommand` fallback for older
  WebViews.
- No JS: the wizard is hidden and a static short guide remains visible.

## Generated assets

```powershell
python apps/animedream/tools/site/make_og.py       # family OG card + 64px favicon
python apps/animedream/tools/site/make_campaign_og.py  # campaign/og-campaign.png + go/og-go.png
python apps/animedream/tools/site/make_campaign_qr.py  # campaign/qr-android.svg + go/qr-android.svg
python apps/animedream/tools/site/make_campaign_screens.py  # 320/480 mockup renditions for campaign/ and go/
npx --yes esbuild apps/animedream/site/campaign/campaign.css --minify --outfile=apps/animedream/site/campaign/campaign.min.css
npx --yes esbuild apps/animedream/site/campaign/campaign.js --minify --outfile=apps/animedream/site/campaign/campaign.min.js
npx --yes esbuild apps/animedream/site/go/go.css --minify --outfile=apps/animedream/site/go/go.min.css
npx --yes esbuild apps/animedream/site/go/go.js --minify --outfile=apps/animedream/site/go/go.min.js
python apps/animedream/tools/site/make_qr.py       # assets/qr-install.svg
python apps/animedream/tools/site/make_grain.py    # assets/grain.png
python apps/animedream/tools/site/make_mascot.py   # assets/mascot.webp + mascot-360.webp
python apps/animedream/tools/site/make_app_shots.py --shots-dir <captures>
# ^ trims status/gesture bars from the raw 1080x2400 device shots
#   (raw captures are not committed: personal library; see store README)
```

`make_og.py` downloads Unbounded + Manrope into `tools/site/.assets`
(gitignored) on first run. Re-run it after a palette, headline or mascot
change; the PNG is committed. The QR points at
`https://ani.place/install.html`.

## Screenshots

`assets/shots/app-*.webp` are 720×1384 straight crops of the original
1080×2400 device captures (status and gesture bars trimmed, no perspective,
no marketing phone frame). The raw captures are deliberately not committed
because they can contain the tester's personal library; the RuStore
marketing frames (`docs/store/rustore/01-catalog.png` …) are a separate
store artifact, not the site source.

`campaign/mockups/*.webp` (and their `go/mockups/` copies) are exported from
the cozy-modern design concept in
`docs/static/design/aniplace-cozy-modern/`, not shipped-app captures. The
campaign and go pages call them «макеты» and keep the family hub's real captures
separate; do not present the concept exports as device screenshots.

Mangaplace has no screenshots; do not add drawn mockups — capture from the
Windows build when a public release exists.

## Deploy

`ani.place` is GitHub Pages from **`bloomstick/aniplace-site`** (source:
`main` / root, `CNAME` = `ani.place`). Copy this folder over a checkout of
that repo, keep its `CNAME`, then commit and push:

```powershell
Copy-Item apps/animedream/site/* <aniplace-site>\ -Recurse -Force
# keep <aniplace-site>\CNAME untouched
git -C <aniplace-site> add -A
git -C <aniplace-site> commit -m "Deploy family hub from dream-monorepo"
git -C <aniplace-site> push origin main
```

`manga.ani.place` is the old standalone landing (`apps/mangaplace/site`).
The hub now carries the Mangaplace presentation in-page. To consolidate,
point that subdomain at `https://ani.place/#mangaplace` (or a small redirect
page) after the hub is live; do not keep two drifting Mangaplace landings.

## Local preview

```powershell
cd apps/animedream/site
python -m http.server 8000
# open http://localhost:8000/ or /changelog.html
```

## Smoke test

`apps/animedream/tools/site/smoke` drives the shipped pages in headless
Chromium against a local server with GitHub-Pages path handling
(`/campaign/`, `/go/` and extensionless `/install`) and stubs every S3/GitHub response,
so it needs no credentials and no network:

```powershell
cd apps/animedream/tools/site/smoke
npm install
npx playwright install chromium   # first time only
npm test
```

It asserts that the campaign and go CTAs start the APK and land on `/install`'s final
step with «Скачивание началось», that `download.js`, `campaign.js` and `go.js` take
version, size, SHA and links from `latest.js` first, and that they fall back
to the GitHub API when that manifest is missing, malformed or has no APK. With
a real `tools/cover_thumbs/config/upload.json` present (or `--config <path>`),
it also checks the site's S3 base against the admin publisher's derived public
base. See the smoke test's `README.md` for flags and scope.

## Pending

- Deploy the hub to `bloomstick/aniplace-site` and decide the
  `manga.ani.place` redirect.
- First public Mangaplace release; the room, ledger row and wizard will
  upgrade automatically once `moeplace/mangaplace-releases` has assets.
- Real Mangaplace screenshots.
- The old `banner-hero.png`, `group-greeting.png`, `mio.webp` and
  `poster-dream.webp` are still unused by the hub (only `mascot.png` is the
  live host). Keep them only if another page still references them,
  otherwise remove in a cleanup pass.
