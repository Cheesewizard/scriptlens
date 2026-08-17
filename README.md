# CB1 x MedBud Ratings

A Chrome extension that pulls patient ratings from [MedBud.wiki](https://medbud.wiki) and shows them
directly on the medication cards in the CB1 Medical patient portal, so browsing doesn't need a second
tab and a manual search for every product.

Each card gains a small badge above its title:

| State | Meaning |
| --- | --- |
| ★★★☆☆ 3.00 · 1 rating | Matched, with MedBud's community average. Colour-coded green / amber / red. |
| Not yet rated | Matched a MedBud page, but nobody has rated it yet. |
| No MedBud entry | No confident match. Hidden by default; enable it in options. |
| MedBud check needed | Cloudflare is challenging requests. Open [medbud.wiki](https://medbud.wiki) in a tab, clear the check, reload. |

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

## How it works

1. The service worker fetches MedBud's medication index once and caches the ~1,200 page paths.
2. The content script reads each card's product name from its `aria-label`.
3. Names are matched against the index. The potency (`T30`), the product code (`WF`, `TT-M`) and the
   strain words all have to agree, which is what stops `LIT WF T30 White Fire` being confused with
   `LIT SL T30 Snow Lotus`.
4. The matched page is fetched and its schema.org `AggregateRating` microdata read.

MedBud requests carry credentials, so a signed-in MedBud session in the same browser applies. Lookups
are capped at four concurrent requests and everything is cached, so a browse session costs a handful of
requests rather than one per card.

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
