# CB1 x MedBud Ratings

A Chrome extension that pulls patient ratings from [MedBud.wiki](https://medbud.wiki) and shows them
directly on the medication cards in the CB1 Medical patient portal, so browsing doesn't need a second
tab and a manual search for every product.

Each card gains a small badge above its title:

| State | Meaning |
| --- | --- |
| View on MedBud | Matched a MedBud page. The default state — see *Why no ratings inline* below. |
| Find on MedBud | Not in the bundled formulary. Links to a search that lands on the page. |
| ★★★☆☆ 3.00 · 1 rating | MedBud's community average, when live ratings are enabled and reachable. |
| Not yet rated | Matched a MedBud page, but nobody has rated it yet. |
| MedBud check needed | Live ratings are on and Cloudflare is refusing the request. |

The product name itself is also a link to the same place, so clicking the medication goes straight
there.

Hovering shows MedBud's per-category breakdown — Medicinal Effect, Tastes & Terpenes, Trim &
Uniformity, Freshness — which is usually what decides an order. The average links through to the full
page for the written reviews.

Once a product is matched, its **name on the card becomes a link** to the same MedBud page, opening in
a new tab. It is an ordinary link, so middle-click and "open in new tab" behave normally, and clicking
it does not also trigger the card's own navigation.

## Installing

1. Clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the repository root.

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

1. A snapshot of MedBud's formulary (1,091 medications) ships in `src/data/medbud-index.json`.
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

- **Minimum match confidence** — raise it if a card shows the wrong product, lower it if a product you
  know is on MedBud shows *No MedBud entry*.
- **Show a badge on products with no MedBud entry** — off by default.
- **Debug logging** — logs matching decisions to the service worker console.
- **Refresh now** / **Clear all cached data**.

## Tests

```
npm install
```

```
npm test
```

The matcher is tested against the real 1,091-entry MedBud formulary and all 23 products from a real
browse page. Eighteen resolve to the correct MedBud page; the other five are genuinely absent from that
index snapshot and are asserted to produce *no* match, since a wrong rating on a medicine is worse than
no rating.

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

## Caveats

- Both sites are scraped, not consumed through an API. The portal is matched on `aria-label`s and
  MedBud on schema.org microdata, which are the most stable handles each site offers, but a markup
  change on either side will still break things. Failures are loud rather than silently wrong.
- MedBud has announced that some data is moving behind a login for MHRA reasons. If that covers
  ratings, sign in to MedBud in the same browser.
- MedBud is behind Cloudflare bot mitigation. The extension works because it inherits the clearance
  your own browsing of MedBud earned; a browser profile that has never visited MedBud gets nothing.
  If every card reads *MedBud check needed*, open MedBud in a tab, clear the check and reload. MedBud's
  `robots.txt` permits the pages this reads, but it is asking for less automated load, which is why a
  challenge backs the extension off rather than making it retry per card.
- Ratings are patient opinions collected by a community site, not clinical guidance. Useful for
  narrowing a shortlist, not for deciding what to take — that conversation belongs with your prescriber.
  MedBud says the same thing on every page it publishes.
- Not affiliated with, endorsed by, or connected to CB1 Medical or MedBud. Built for personal use.
