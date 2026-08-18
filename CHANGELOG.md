# Changelog

## 1.0.0

First public release, as **ScriptLens**.

- Adds a **View on MedBud** link to every medication on the CB1 Medical portal — patient reviews without
  a second tab or a copy-paste. Flower cards also get a **Leafly** link to the strain's terpene and
  effect profile.
- Resolves the orderable catalogue to exact MedBud pages via a bundled, index-verified mapping and a
  local matcher (~90% direct links); anything unrecognised falls back to a search that still lands on
  the right page.
- Reads **every** product, including those out of stock or over your THC limit — they have no "Add to
  cart" button but still show reviews worth reading.
- Runs entirely in the browser: no analytics, no account, no server, and no personal or medical data
  ever leaves your browser. See [PRIVACY.md](PRIVACY.md).

Inline rating numbers are not shown: MedBud is behind bot protection that refuses the extension's
background requests, so ScriptLens links to the reviews rather than fetching them. The option to fetch
them is present but off by default, in case that protection relaxes.
