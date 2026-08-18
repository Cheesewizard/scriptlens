# Changelog

## 1.0.0

First public release, as **ScriptLens**.

- Adds a **View on MedBud** link to every medication on the CB1 Medical portal — patient reviews without
  a second tab or a copy-paste. Flower cards also get a **Leafly** link to the strain's terpene and
  effect profile.
- Resolves the orderable catalogue to exact MedBud pages via a bundled, index-verified mapping and a
  local matcher. Anything it can't place directly — a renamed or newly listed product — falls back to a
  Google search for the product that still lands on the right page.
- Reads **every** product, including those out of stock or over your THC limit — they have no "Add to
  cart" button but still show reviews worth reading.
- Runs entirely in the browser: it fetches nothing and only ever builds links for you to click. No
  analytics, no account, no server, and no personal or medical data ever leaves your browser. Its only
  site permission is the CB1 Medical portal itself. See [PRIVACY.md](PRIVACY.md).

ScriptLens links to the reviews rather than showing rating numbers on the card: reading MedBud's data
programmatically would need their permission, and their pages are behind bot protection that refuses it.
