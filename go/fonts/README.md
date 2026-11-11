# Landing fonts

The campaign and go pages self-host only the variable faces they render:
Caveat 500–600, Manrope 400–800 and Unbounded 500–800, each split into
Cyrillic, Latin and Latin-ext. `campaign.css` / `go/go.css` contain the
matching `@font-face` rules and Unicode ranges; `index.html` preloads only
`unbounded-cyrillic.woff2`.

Sources are the Google Fonts WOFF2 files referenced by the CSS request for the
same families and weight ranges. Caveat, Manrope and Unbounded are distributed
under the SIL Open Font License 1.1.
