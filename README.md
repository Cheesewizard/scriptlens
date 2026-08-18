# ScriptLens

A browser extension that links every medication in the CB1 Medical patient portal to its
[MedBud](https://medbud.wiki) patient reviews and its [Leafly](https://www.leafly.com) strain profile —
so browsing doesn't need a second tab and a manual search for every product.

Free, open source, and unaffiliated with CB1 Medical, MedBud or Leafly. Runs entirely in your browser;
no analytics, no account, and no personal or medical data ever leaves it ([privacy policy](PRIVACY.md)).

Each card gains a small **View on MedBud** button above its title — one behaviour, one label. Almost
always it opens the medication's exact MedBud page; for the occasional product MedBud has renamed or not
yet listed, the same button runs a search that lands on it, with nothing on the card to distinguish the
two.

Flower cards carry a second button, **Leafly**, to the strain's terpene and effect profile. MedBud is
the patient reviews; Leafly is the strain data. Leafly is organised by strain rather than by product and
its naming does not follow from a CB1 name, so this link runs a search scoped to Leafly's strain pages
rather than guessing a URL that would usually be wrong.

The extension only ever offers a **link** — it does not fetch reviews or ratings and show them on the
card. Reading MedBud's rating data programmatically would need MedBud's permission, and their pages are
behind bot protection that refuses it anyway. So ScriptLens takes you to the reviews rather than
scraping them.

## Installing

Until it is on the Chrome Web Store, load it unpacked (works in Chrome, Brave, Edge and other
Chromium browsers):

1. Download this repository (**Code → Download ZIP**, or clone it) and unzip it.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the folder.

No build step — the extension loads as-is.

## How it works

1. A snapshot of MedBud's formulary (1,162 medications) ships in `src/data/medbud-index.json`.
2. The content script reads each card's product name from its `aria-label`.
3. Names are matched against the formulary. The potency (`T30`), the product code (`WF`, `TT-M`) and
   the strain words all have to agree, which is what stops `LIT WF T30 White Fire` being confused with
   `LIT SL T30 Snow Lotus`.
4. A confident match links to that medication's page. Anything else links to a search restricted to
   MedBud, which is what finds a medication listed since the snapshot, or renamed.

The fallback is the common path, not an edge case. Stock rotates constantly and MedBud renames
medications: CB1's `Aurora Pedanios SRD T29 Sourdough` is MedBud's `Aurora SRD-CA T29 Sourdough` at
`/strains/aurora-pedanios/pedanios-t29/` — a slug with neither the product code nor the strain name in
it. No token matcher resolves that; a search does.

Each resolved link is cached so it is not recomputed on every page load: a match for 12 hours, a
fallback for 1 hour (the likeliest reason for a miss is a medication MedBud has only just listed).

## Configuration

- **Minimum match confidence** — raise it if a card shows the wrong medication, lower it if a familiar
  product falls back to a search.
- **Show a search link on products the bundled formulary does not list** — on by default.
- **Debug logging** — logs matching decisions to the service worker console.
- **Clear all cached data**.

## Tests

```
npm install
```

```
npm test
```

The matcher is tested against the formulary the extension actually ships — 1,162 medications — and a
real browse page. Products genuinely absent from the formulary are asserted to produce *no* match,
since a wrong medication is worse than none, and the two wrong matches an earlier, looser potency rule
produced against live stock are kept as regression tests.

The card scanner is tested against the real card grid, so a portal reskin fails the suite rather than
being discovered on the site. `linkedom` provides the DOM as a `devDependency`; the extension itself
ships with no runtime dependencies.

Fixtures are regenerated from a saved browse page with:

```
node tools/make-card-fixture.mjs "path/to/Browse - CB1 Medical.html"
```

A saved browse page carries your name and your prescription balances. The tool copies only the card
grid and refuses to write a fixture that still contains any of it — but don't commit the saved page
itself.

## Keeping it current

The data is a frozen snapshot — nothing self-updates. When CB1 rotates stock or either site reskins,
[docs/MAINTENANCE.md](docs/MAINTENANCE.md) has the symptom-to-fix table and the exact refresh recipes.

## Support

ScriptLens is free and maintained in spare time. If it saves you time, you can
[sponsor its upkeep](https://github.com/sponsors/Cheesewizard) — entirely optional, and it stays free
either way. Changes are logged in [CHANGELOG.md](CHANGELOG.md).

## Caveats

- The portal is read from `aria-label`s, the most stable handle it offers, but a reskin will still
  break things. Failures are loud rather than silently wrong.
- The formulary ships with the extension and does not update itself, so newly listed medications fall
  back to a search until it is refreshed (see [docs/MAINTENANCE.md](docs/MAINTENANCE.md)).
- Ratings on MedBud are patient opinions collected by a community site, not clinical guidance. Useful
  for narrowing a shortlist, not for deciding what to take — that conversation belongs with your
  prescriber.
- Not affiliated with, endorsed by, or connected to CB1 Medical, MedBud or Leafly. Built for personal
  use.
