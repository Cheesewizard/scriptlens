# ScriptLens

A browser extension that links every medication in the CB1 Medical patient portal to its
[MedBud](https://medbud.wiki) patient reviews and its [Leafly](https://www.leafly.com) strain profile.
No more opening a second tab and searching for each product by hand.

<p align="center">
  <img src="docs/preview-1280x800.png" width="760"
       alt="ScriptLens adds a green 'View on MedBud' button and a separate 'Leafly' button above every product on the CB1 Medical portal">
</p>

It's free, open source, and not affiliated with CB1 Medical, MedBud or Leafly. It runs entirely in your
browser. There's no analytics, no account, and no personal or medical data ever leaves it (see the
[privacy policy](PRIVACY.md)).

Every card gets a small **View on MedBud** button above its title. Most of the time it opens the
medication's exact MedBud page. If MedBud has renamed a product or hasn't listed it yet, the button runs
a search that lands on it instead, and the card looks the same either way.

Flower cards get a second button, **Leafly**, for the strain's terpene and effect profile. MedBud has
the patient reviews, Leafly has the strain data. Leafly names its strains differently from CB1, so that
link runs a search scoped to Leafly's strain pages rather than guessing a URL that would usually be
wrong.

The extension only ever gives you a link. It doesn't fetch reviews or ratings to show on the card.
Reading MedBud's ratings automatically would need their permission, and their pages block automated
requests anyway, so ScriptLens sends you to the reviews instead of scraping them.

## Installing

Until it's on the Chrome Web Store, load it unpacked. This works in Chrome, Brave, Edge and other
Chromium browsers.

1. Download this repository (**Code → Download ZIP**, or clone it) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick the folder.

There's no build step. It loads as-is.

## How it works

1. A snapshot of MedBud's formulary (1,162 medications) ships in `src/data/medbud-index.json`.
2. The content script reads each card's product name from its `aria-label`.
3. Names are matched against the formulary. The potency (`T30`), the product code (`WF`, `TT-M`) and the
   strain words all have to agree. That's what stops `LIT WF T30 White Fire` matching `LIT SL T30 Snow
   Lotus`.
4. A confident match links to that medication's page. Anything else links to a search restricted to
   MedBud, which still finds products that were renamed or listed after the snapshot.

The search fallback is normal, not a rare edge case. Stock rotates constantly and MedBud renames things.
CB1's `Aurora Pedanios SRD T29 Sourdough` lives at MedBud's `/strains/aurora-pedanios/pedanios-t29/`, a
slug with neither the product code nor the strain name in it. No token matcher can resolve that. A
search can.

Each resolved link is cached so it isn't recomputed on every page load: a match for 12 hours, a fallback
for 1 hour (a miss usually means a medication MedBud only just listed).

## Configuration

- **Minimum match confidence.** Raise it if a card shows the wrong medication. Lower it if a familiar
  product falls back to a search.
- **Show a search link on products the bundled formulary doesn't list.** On by default.
- **Debug logging.** Logs matching decisions to the service worker console.
- **Clear all cached data.**

## Good to know

- A major redesign of the CB1 portal could stop it working. If that happens the buttons simply stop
  appearing — it won't quietly send you to the wrong page.
- The medication list is built into the extension and doesn't update itself, so a brand-new product can
  fall back to a search until the list is refreshed.
- MedBud ratings are patient opinions from a community site, not medical advice. They help you narrow a
  shortlist, not decide what to take — that's a conversation for your prescriber.
- Not affiliated with, endorsed by, or connected to CB1 Medical, MedBud or Leafly.

## Support

Free, and maintained in spare time. If it saves you time, you can
[sponsor its upkeep](https://github.com/sponsors/Cheesewizard) — optional, and it stays free either way.

## Development

Contributions and fixes are welcome. Run the tests with `npm install`, then `npm test`. Keeping the
built-in medication list current — and everything else a maintainer needs — is in
[docs/MAINTENANCE.md](docs/MAINTENANCE.md). Changes are logged in [CHANGELOG.md](CHANGELOG.md).
