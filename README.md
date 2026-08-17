# CB1 x MedBud Ratings

A Chrome extension that pulls patient ratings from [MedBud.wiki](https://medbud.wiki) and shows them
directly on the medication cards in the CB1 Medical patient portal, so a browse session doesn't need a
second tab and a manual search for every product.

Each card gains a small badge above its title:

| State | Meaning |
| --- | --- |
| ★★★☆☆ 3.00 · 1 rating | Matched, with MedBud's community average. Colour-coded green / amber / red. |
| Not yet rated | Matched a MedBud page, but nobody has rated it yet. |
| No MedBud entry | No confident match. Hidden by default; enable it in options. |

The average links straight through to the MedBud page for the full reviews and terpene breakdown.

## Installing

1. Clone this repository.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Choose **Load unpacked** and select the repository root.

There is no build step — the extension loads as-is.

### Portal domain

The manifest matches `https://*.cb1medical.com/*`. If the patient portal is served from a different
domain, change the three `matches` / `host_permissions` entries in `manifest.json` to that origin and
reload the extension. Nothing else needs to change.

## How it works

1. On first use the service worker fetches MedBud's full medication index once and caches the ~1,200
   medication page paths for 24 hours.
2. The content script finds product cards on the page and reads each card's title.
3. Titles are matched against the index by token overlap. The THC/CBD code (`T30`, `T7:C7`) has to
   agree, which is what keeps `LIT WF T30 White Fire` from being confused with `LIT SL T30 Snow Lotus`.
4. The matched MedBud page is fetched, its average rating read, and the result cached for 12 hours.

MedBud requests carry credentials, so if you're signed in to MedBud in the same browser that session
applies. Lookups are capped at four concurrent requests and every result is cached, so a full browse
page costs a handful of requests per day rather than one per card view.

## Configuration

Open the extension's options page for:

- **Minimum match confidence** — raise it if a card shows the wrong product, lower it if a product you
  know is on MedBud shows *No MedBud entry*.
- **Show a badge on products with no MedBud entry** — off by default.
- **Debug logging** — logs matching decisions to the service worker console.
- **Clear cache** — forces a fresh index and rating fetch.

## Tests

```
npm test
```

Covers the matcher against real product names taken from the portal's browse grid.

## Caveats

- Both sites are scraped, not consumed through an API. A markup change on either side will break
  matching; the modules fail loudly rather than silently showing a wrong rating.
- MedBud has announced that some data will move behind a login for MHRA reasons. If that covers
  ratings, sign in to MedBud in the same browser.
- Ratings are patient opinions collected by a community site, not clinical guidance. They're useful for
  narrowing a shortlist, not for deciding what to take — that conversation belongs with your prescriber.
- Not affiliated with, endorsed by, or connected to CB1 Medical or MedBud. Built for personal use.
