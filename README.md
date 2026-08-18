# BudLens

A browser extension that links every medication in the CB1 Medical patient portal to its
[MedBud](https://medbud.wiki) patient reviews and its [Leafly](https://www.leafly.com) strain profile —
so browsing doesn't need a second tab and a manual search for every product.

Free, open source, and unaffiliated with CB1 Medical, MedBud or Leafly. Runs entirely in your browser;
no analytics, no account, and no personal or medical data ever leaves it ([privacy policy](PRIVACY.md)).

Each card gains a small badge above its title:

| State | Meaning |
| --- | --- |
| View on MedBud | Links to the medication's MedBud page. The normal state of every card. |
| ★★★☆☆ 3.00 · 1 rating | MedBud's community average, when live ratings are enabled and reachable. |
| Not yet rated | Nobody has rated the medication yet. |
| MedBud check needed | Live ratings are on and Cloudflare is refusing the request. |

The **View on MedBud** button is one behaviour, one label. Almost always it opens the medication's exact
page; for the occasional product MedBud has renamed or not yet listed, the same button runs a search
that lands on it, with nothing on the card to distinguish the two.

Flower cards carry a second button, **Leafly**, to the strain's terpene and effect profile. MedBud is
the patient reviews; Leafly is the strain data. Leafly is organised by strain rather than by product and
its naming does not follow from a CB1 name, so this link runs a search scoped to Leafly's strain pages
rather than guessing a URL that would usually be wrong.

Hovering shows MedBud's per-category breakdown — Medicinal Effect, Tastes & Terpenes, Trim &
Uniformity, Freshness — which is usually what decides an order. The average links through to the full
page for the written reviews.

## Installing

Until it is on the Chrome Web Store, load it unpacked (works in Chrome, Brave, Edge and other
Chromium browsers):

1. Download this repository (**Code → Download ZIP**, or clone it) and unzip it.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the folder.

No build step — the extension loads as-is.

## Why no ratings inline

MedBud is behind Cloudflare bot mitigation that refuses the extension's background requests outright —
`403`, `cf-mitigated: challenge` — while the same URL loads fine in a tab. There is no way for an MV3
background fetch to present as a page navigation, and the workaround that would "fix" it is automating
what that protection exists to stop. So the extension does not fetch from MedBud at all.

Instead it ships MedBud's formulary and does the matching locally, then links you to the page. You lose
the number on the card; you keep never having to search for the medication by hand.

Live fetching is still in the code behind an off-by-default option, for if MedBud's protection relaxes.

## How it works

1. A snapshot of MedBud's formulary (1,162 medications) ships in `src/data/medbud-index.json`.
2. The content script reads each card's product name from its `aria-label`.
3. Names are matched against the formulary. The potency (`T30`), the product code (`WF`, `TT-M`) and
   the strain words all have to agree, which is what stops `LIT WF T30 White Fire` being confused with
   `LIT SL T30 Snow Lotus`.
4. A confident match links to that medication's page. Anything else links to a search restricted to
   MedBud, which is what finds a medication listed since the snapshot, or renamed.
5. With a Brave Search API key set, that search is done for you: hovering a card looks the medication
   up, so the name links straight to its page. The search engine is asked, never MedBud.

The fallback is the common path, not an edge case. Stock rotates constantly and MedBud renames
medications: CB1's `Aurora Pedanios SRD T29 Sourdough` is MedBud's `Aurora SRD-CA T29 Sourdough` at
`/strains/aurora-pedanios/pedanios-t29/` — a slug with neither the product code nor the strain name in
it. No token matcher resolves that; a search does.

### Cache lifetimes

New medications are listed constantly, so nothing is cached for long, and a miss actively chases a
refresh rather than waiting one out:

| Data | Lifetime |
| --- | --- |
| Medication index | 6 hours |
| Product rating | 6 hours |
| Successful match | 12 hours |
| Failed match | 1 hour |

If a product doesn't match and the index is more than 30 minutes old, the index is refetched
immediately and the match retried once. A strain that appeared on MedBud this morning therefore shows
up on the next page load rather than after the cache happens to expire. The options page shows the
index age and offers a manual refresh.

## Configuration

- **Minimum match confidence** — raise it if a card shows the wrong medication, lower it if a familiar
  product falls back to a search.
- **Brave Search API key** — optional. Turns the search fallback into a direct link, resolved on hover.
- **Show a search link on products the bundled formulary does not list** — on by default.
- **Fetch ratings from MedBud** — off by default; currently refused by Cloudflare.
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

BudLens is free and maintained in spare time. If it saves you time, you can
[sponsor its upkeep](https://github.com/sponsors/Cheesewizard) — entirely optional, and it stays free
either way. Changes are logged in [CHANGELOG.md](CHANGELOG.md).

## Caveats

- The portal is read from `aria-label`s, the most stable handle it offers, but a reskin will still
  break things. Failures are loud rather than silently wrong.
- MedBud has announced that some data is moving behind a login for MHRA reasons. If that covers
  ratings, sign in to MedBud in the same browser.
- MedBud is behind Cloudflare bot mitigation that refuses the extension's requests — its sitemap
  included — which is why ratings are not fetched and the formulary ships with the extension rather
  than updating itself. MedBud's `robots.txt` permits the pages this reads, but the protection is
  blunt, so the extension does not argue with it.
- Ratings are patient opinions collected by a community site, not clinical guidance. Useful for
  narrowing a shortlist, not for deciding what to take — that conversation belongs with your prescriber.
  MedBud says the same thing on every page it publishes.
- Not affiliated with, endorsed by, or connected to CB1 Medical or MedBud. Built for personal use.
