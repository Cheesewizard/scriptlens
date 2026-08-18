# Maintenance

The extension ships a hand-captured snapshot of MedBud's data and never updates itself — MedBud's index
and sitemap are Cloudflare-blocked, so the data is collected by hand. As the two sites change, individual
links fall back to a search rather than breaking. This is the guide to refreshing them.

## How a link is resolved

A card's link is worked out in this order — first hit wins:

1. **Mapping** — `src/data/medbud-mapping.json`, a hand-verified `exact CB1 name → MedBud path` table.
   This is the only thing that resolves carts, oils and pastilles.
2. **Matcher** — `product-matcher.js` scores the name against `src/data/medbud-index.json`, a snapshot of
   MedBud's flower index (`/strains/` only, ~1,162 entries). Flower only.
3. **Search fallback** — a search scoped to `medbud.wiki` (or `leafly.com/strains` for the Leafly link).
   Always works and never breaks, so nothing ever fully fails.

The cache (in `rating-service.js`) just remembers the answer per product name, keyed with
`RESOLUTION_VERSION`. It does no matching of its own.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| A **new flower** links to search | Not in the formulary snapshot | Recipe A |
| A **new cart / oil / pastille** links to search | Not in the mapping | Recipe B |
| A card links to the **wrong** medication | Bad mapping entry, or a bad matcher match | Recipe C |
| **All** cards link to search after an update | Stale cache shadowing new logic | Recipe E |
| **No badges at all** | CB1 reskinned the portal | Recipe D |

## Recipes

Each recipe starts by saving the relevant page — **Save page as… → Webpage, Complete** — while signed in
and after the full grid has loaded. Saved CB1 pages carry your name and prescription balances; the tools
copy only what they need and never commit the raw page. Run `npm test` after any change.

### A. Refresh the flower formulary

When new flower isn't resolving. Save MedBud's flower index (`medbud.wiki/strains/`, scroll to the
bottom so it all loads), then:

```bash
node tools/make-formulary.mjs "path/to/All Flower_Strains … MedBud.html"
```

This regenerates `src/data/medbud-index.json`. It refuses to shrink the formulary, so a half-loaded save
fails loudly. Then do Recipe E.

### B. Add carts / oils / pastilles, or any renamed product

The mapping is `name → path`, and a wrong path points a card at the wrong medicine, so entries are
verified against MedBud's own index pages — never trusted from a search snippet. This is how the current
mapping was built:

1. Save the relevant MedBud section index — `medbud.wiki/vape-cartridges/`, `/oils/`, or the CB1 tab you
   need — and the CB1 tab page.
2. List the CB1 products that still fall back (open the service-worker console, or diff against the
   mapping keys).
3. For each, find its path by searching the saved MedBud index for the brand, and confirm the slug names
   the same strain:
   ```bash
   grep -o -E "/vape-cartridges/<brand>/[a-z0-9-]+/" "path/to/All Vape Cartridges … .html" | sort -u
   ```
4. Add the verified `"exact CB1 name": "/section/brand/product/"` line to `medbud-mapping.json`.
5. Confirm every path you added actually appears in a saved MedBud index page:
   ```bash
   grep "/oils/curaleaf/peppermint-t20c40/" "path/to/All Sublingual Oils … .html"
   ```

Adding mapping entries does not need a `RESOLUTION_VERSION` bump — the mapping is checked before the
cache, so a new entry always wins over a stale miss.

### C. A card links to the wrong medication

The one that matters most — a wrong rating on a medicine is worse than none.

- **If it is a mapping entry** (cart/oil/pastille, or a hand-added flower): fix or delete the line in
  `medbud-mapping.json`. Deleting it drops the card to search, which is safe.
- **If it is a matcher match** (flower, not in the mapping): it is a scoring bug. Add the product name
  and the wrong path as a regression test in `tests/product-matcher.test.mjs` (see the existing
  "does not cross brands…" tests), then tighten `product-matcher.js` until it rejects the match. Then do
  Recipe E.

### D. Badges vanished — portal reskin

The scanner keys off `aria-label="Add … to request"`. If CB1 changes that, `findProductCards` returns
nothing. Regenerate the fixture for the affected tab and run the scanner tests to see what broke:

```bash
node tools/make-card-fixture.mjs "path/to/Browse - CB1 Medical.html"            # flower
node tools/make-card-fixture.mjs "path/to/vape - CB1 Medical.html" cb1-vape-grid.html
node tools/make-card-fixture.mjs "path/to/oil - CB1 Medical.html" cb1-oil-grid.html
node tools/make-card-fixture.mjs "path/to/pastil - CB1 Medical.html" cb1-pastille-grid.html
```

If the fixture comes out empty, the label format changed — update the selectors in `card-scanner.js`
(and, if the strain moved, `shared/strain.js`) until the scanner tests pass again.

### E. Bump the resolution version

After any change to the matcher, the formulary, or a correction to a mapping entry, bump
`RESOLUTION_VERSION` in `src/background/rating-service.js`:

```js
const RESOLUTION_VERSION = 3;   // was 2
```

Every user's cached results from the old logic are then ignored on the next load — no manual cache clear.
Forgetting this is why "I fixed it but it still shows the old link" happens.

## Changing code, not just data

- **A new MedBud section** (beyond strains / vape-cartridges / oils / edibles / extracts): add it to
  `MEDBUD_PATH_PATTERN` in `shared/medbud-link.js`.
- **A new portal** (not CB1): the scanner and strain extraction assume CB1's `aria-label` and
  `<brand> <code> <potency> <strain> <form>` naming. A different portal needs its own scanner; the
  background resolution is reusable as-is.
- **A new provider** (beyond MedBud and Leafly): follow the Leafly shape — a `shared/<x>-link.js` that
  builds a search URL from the strain or product, and an `appendStrainLink`-style call in `main.js`.

## The rule that matters

Verify before you ship. Every path that reaches a card should have been found in a real saved MedBud
page. The search fallback always catches a miss — but a *wrong* direct link has no safety net, and this
points at medicine.
