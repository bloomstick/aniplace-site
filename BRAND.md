# place family hub — brand & page style

The site at `ani.place` is the family hub for **Aniplace** (anime) and
**Mangaplace** (manga). Russian only for v1. It is not an Aniplace-only
landing; both products stay present on the page, with Mangaplace honestly
marked **скоро** until its first public build.

## Type

- Display: **Unbounded** (500–800) — H1/H2/H3, versions, step numbers.
- Body/UI: **Manrope** (400–800) — copy, buttons, labels.
- Hand: **Caveat** (500–600) — short margin notes, the mascot caption, the
  footer sign-off. Never use it for body copy or instructions.
- Load from Google Fonts with `display=swap`; the page must remain readable
  with the system fallback.

## Palette (`styles.css`)

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#fdf4ec` | main ground, matches the mascot sheet |
| `--paper-2` | `#f7e9dc` | screenshot / release bands |
| `--ink` | `#2a2027` | text, borders, footer ground |
| `--ink-soft` | `#6d5a63` | secondary copy on paper |
| `--red` | `#e11d48` | Aniplace actions, stamps, checks |
| `--red-deep` | `#b0133a` | small red text on paper |
| `--navy` | `#202a4a` | Mangaplace room |
| `--pink` | `#ffb6cf` | tape, footer links, selection |
| `--pink-soft` | `#ffe3ec` | hero sun, marquee, callouts |
| `--butter` | `#ffe4a3` | Mangaplace stamps and checks |

The red and navy are the app brands; keep them in step with
`apps/animedream/lib/src/brand/aniplace_brand.dart` and the Mangaplace
lockup. The cream/pink ground is the old handmade soul, not a generic pastel
theme: keep the ink borders, hard shadows, paper grain and stamps.

## Page structure

- **Header:** a paper masthead, not a glass bar. The red seam across the top,
  the “place.” wordmark, the rotated “аниме + манга” tag, plain nav links and
  a red stamp download button. On phones the tag disappears, the button stays,
  and the full nav lives in the bordered paper menu. No app-icon row in the
  header; the rooms carry the icons.
- **Hero:** one mascot sticker sheet (taped, slightly rotated) plus one real
  catalog screen in a straight frame. A Caveat note (“заходи, тут уютно”)
  and a speech bubble are the only handwritten moments. “Место” is red with
  the hand-drawn underline; the H1's second line is `.hero-line`
  (`white-space: nowrap`) so “Одно место.” never breaks onto three lines;
  reduce the font before removing the no-wrap.
- **Rooms:** both apps visible at once, no tabs. Aniplace is the wide red/white
  room with a real title-page screen, three ticks and the download CTA.
  Mangaplace is the narrower navy cover, content centred, with an M watermark,
  a butter “скоро” stamp and a GitHub watch link. The Manga room carries
  `data-release-card="mangaplace"` and `data-when` hooks so it upgrades with
  the release.
- **Screenshots:** only real Aniplace captures: 720×1384 straight crops of the
  raw 1080×2400 device shots, status/gesture bars trimmed. A contact sheet on
  a page-sheet border with numbered captions, arrows and an `01 / 06` counter.
  The selected frame carries a red border and hard red shadow; keep that
  feedback visible even when the rail is clamped at max scroll.
  No dots, no tilted marketing mockup, no perspective, no phone-in-phone.
  Mangaplace has none; wait for real captures.
- **Install:** three numbered steps and a taped paper card with the wizard
  link + RuStore. The non-obvious warnings (Android permission, Windows
  SmartScreen) are stated once. `install.html` is the real app/device wizard.
- **Releases:** a ledger table (application / version / files / links), not
  two cards. Aniplace is live; Mangaplace flips from “soon” to real files when
  `download.js` finds a release.
- **Changelog:** `changelog.html` is the ledger continued as a ruled history.
  Each app gets an icon + name chapter, then a version timeline: version in
  Unbounded, Russian date, and release notes. The latest entry is open; older
  entries fold into `<details>` with a red/hollow timeline dot and a +/−
  marker. The GitHub source note and both release links are static HTML; the
  no-JS note is part of the page. No new art, no generic card grid.
- **FAQ + footer:** editorial two-column questions, then an ink colophon with
  both apps (the footer app icons link to their rooms), GitHub, RuStore
  (Android alternative), 16+ and the “продолжение следует” sign-off.
  «Что нового» lives in the «Ещё» column on all three pages; the current
  page carries `aria-current="page"`.

## Anti-template rules

The previous dark landing read as a SaaS template. Do not bring these back:

- numbered eyebrow labels (`01 · …`) on every section;
- identical section rhythm (eyebrow → h2 → lead → card grid) for every block;
- equal product cards with a tab switch;
- a dots carousel (use the counter/arrows contact sheet);
- a three-column icon + title + line “trust” row;
- neon glows, mesh gradients, glass blur, floating chips;
- tilted/perspective screenshots inside fake phones;
- stock “AI” phrasing (“Три шага — и ты внутри”, “Собери свою инструкцию”,
  “Открытый changelog”, “GitHub — основной канал…”).

Warmth comes from specific things, not more decoration: the mascot, the
paper grain, the tape, the stamps, the Caveat margin notes, the real screens.
Use one or two per composition, not all at once.

## Download contract

- `data-dl-app` + `data-dl-os` (`aniplace|mangaplace` × `android|windows|auto`)
  are the CTA hooks.
- `data-release-app` + `data-release-field` fill version/date/sizes/release
  URL/SHA URL/watch URL.
- `data-dl-icon` must show the target platform in the CTA; `data-dl-ready`
  marks a real file. A normal click opens the file in a separate tab and
  opens the install guide at step 3 with
  "Скачивание началось. Не скачивается? Повторить" in a full-width strip
  above the wizard card. The guide navigation
  must never cancel the attachment. A blocked popup falls back to a hidden
  frame; the result and retry remain normal new-tab links. Modifier clicks
  keep the browser’s own behaviour.
- Android gets Android only: hide Windows offers with
  `data-os-only="windows"` / `data-dl-platform="windows"` and skip the device
  step in the wizard. Desktop keeps the Android/Windows choice.
- Primary channel is **GitHub Releases**; RuStore is the visible Android
  alternative.
- The changelog header keeps a plain `install.html` «Скачать» link instead
  of the `data-dl` hook, so that page loads no `download.js` and makes only
  its two changelog API calls. Do not add platform-download behavior there
  without also including the early platform script and `download.js`.
- `download.js` accepts both `*-windows-setup.exe` and `*-windows.zip`, so
  keep labels generic (“Windows”, “сборка”) and let the file name/size tell
  the truth.
- No dead direct links: if the API fails, Aniplace uses `FALLBACK`; if
  Mangaplace has no release, the room/row stay “soon”.
- The QR points at `https://ani.place/install.html`.

## Motion & accessibility

- Scroll reveal, the seamless marquee and hover lifts are CSS/JS only; all
  freeze under `prefers-reduced-motion`.
- Focus is visible everywhere (`:focus-visible`, 3px red).
- No canvas/WebGL, no blur layers over scrolling content; the page is a
  static site with small scripts.
- One fixed paper-grain layer (`assets/grain.png`, generated by
  `make_grain.py`) keeps the cream and ink from reading as flat fills. Keep
  it low-opacity and pointer-events-none.
- Marketing surfaces use `user-select: none`; FAQ, changelog release notes
  and install instructions stay selectable. Do not disable selection on
  code/paths.
- Changelog release bodies are untrusted Markdown: escape first, then add
  only the supported markup; never inject raw HTML. Version dates use
  `<time datetime>`; release links open GitHub and carry
  `rel="noopener noreferrer"`.
- Lighthouse target for all three pages: 100 accessibility / best practices /
  SEO. Keep contrast ≥ 4.5:1 for small text; use `--ink-soft` on paper, not
  a lighter muted.

## Share card

- `assets/og-cover.png` is 1200×630, generated by
  `apps/animedream/tools/site/make_og.py`; never hand-edit.
- It carries the cream ground, the “place.” wordmark, the “Два мира. Одно
  место.” headline with the red word, both app chips and the mascot sheet
  with tape and a “заходи!” bubble. `og:image` / `twitter:image` point at it.
- Favicon is the 64px “p” tile generated alongside the share card; the header
  uses the same wordmark, not the old fox-only logo tile.

## Legacy art

`mascot.png` is the live host (served as `mascot.webp` + `mascot-360.webp`).
`banner-hero.png`, `group-greeting.png`, `mio.webp` and `poster-dream.webp`
are still unused by the hub. Keep them only for the store handoff docs or
remove in a cleanup pass; do not reintroduce a second character or a cast
wall without a design decision.
