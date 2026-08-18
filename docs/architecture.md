# Architecture

## Why the work is split across contexts

Content scripts cannot make cross-origin requests under the extension's host permissions - since
Chrome 85 those fetches follow the page's CORS rules. Every MedBud request therefore runs in the
service worker, and the content script only talks to it over `chrome.runtime.sendMessage`.

MV3 also refuses to load a content script as an ES module from the manifest. `src/content/loader.js` is
a classic script whose only job is to dynamically import `main.js`, which lets the rest of the
content-side code use normal imports. That is why `src/content/*.js` and `src/shared/*.js` appear in
`web_accessible_resources`.

## Modules

| Module | Responsibility |
| --- | --- |
| `background/service-worker.js` | Message routing only. |
| `background/rating-service.js` | Resolves a product to its MedBud link (mapping, matcher, or search); de-duplicates in-flight lookups. |
| `background/medbud-index.js` | Loads and pre-tokenises the bundled medication formulary. |
| `background/product-matcher.js` | Pure functions: tokenising and scoring. No I/O, so directly testable. |
| `background/product-mapping.js` | The shared name-to-medication mapping and its validation. |
| `shared/medbud-link.js` | Builds the medication URL, or the search that replaces it. |
| `background/request-queue.js` | Caps concurrent outbound requests. |
| `background/http-cache.js` | TTL cache over `chrome.storage.local`. |
| `content/card-scanner.js` | Locates product cards and their titles. |
| `content/rating-badge.js` | Builds and updates the badge DOM. |
| `shared/strain.js` | Pulls the strain name out of a flower product name. |
| `shared/leafly-link.js` | Builds the Leafly strain search for that name. |
| `content/main.js` | Scanning loop and mutation observer. |

## Reading the CB1 portal

The portal is React Native Web, so class names are hashed atomic utilities (`css-146c3p1 r-1jkcow7`)
and worthless as selectors. Accessibility labels, however, are stable and carry the exact product name:

```html
<div aria-label="LIT WF Smalls T30 White Fire Flower 10g image">…</div>
<div dir="auto" class="…">LIT WF Smalls T30 White Fire Flower 10g</div>
<button aria-label="Add LIT WF Smalls T30 White Fire Flower 10g to request">…</button>
```

So cards are found by the **product image**, and the card root is the nearest ancestor of it that also
holds the title bearing the same product name - which validates the pairing via that name rather than
trusting a fixed depth, and filters out any stray image whose label happens to end in "image". The
badge goes before that title element.

The image is used rather than the "Add to request" button on purpose. A product that is out of stock or
over the patient's THC limit has no add button - it shows a disabled "THC (%) limit" instead - but it
still has an image and a title, and its reviews are worth just as much. Keying off the button silently
hid every such product: on the flower tab that was 88 of 128. The image is present on every card.

The grid recycles DOM nodes when filters or tabs change, so a decorated card can come back holding a
different product. Cards record which product they were decorated for in `data-medbud-product`, and a
result arriving after the node has been reused is discarded.

Navigation is the badge alone - a **View on MedBud** button (and, for flower, **Leafly**). The product
title was once a link too, but that duplicated the button and, on a search fallback, sent the name to a
Google search, so it was removed. The portal's title element is left untouched; the badge simply sits
before it.

## Leafly

Flower cards carry a second link, to the strain's Leafly terpene and effect profile, alongside the
MedBud review link. It is a different join: MedBud is matched on the product (the full SKU), Leafly on
the strain alone, pulled out of the product name - the words between the potency and the form, with the
pack and batch markers dropped (`shared/strain.js`). Only flower gets it, which is where a terpene
profile is what a buyer reaches for.

The link is a search, not a direct page, and deliberately so: Leafly's naming does not follow from a
CB1 name - its "White Fire" is `/strains/white-fire-og` - and there is no bundled Leafly index to
verify a slug against, so a guessed URL would 404 more often than not. A search scoped to
`leafly.com/strains` lands on the right strain instead. No fetch is made to Leafly; only a link is
offered, so its bot protection and terms are never engaged. This is the same shape as the whole
extension: join two sites through their most stable handle, link out, never scrape what is gated.

## Never fetching MedBud

The extension only ever offers a **link** to MedBud; it never requests a page from it. Showing a
rating on the card would mean reading MedBud's data programmatically, which needs their permission -
and their pages are behind Cloudflare bot protection that refuses automated requests anyway. So there
is no fetching, no `medbud.wiki` host permission, and nothing to be blocked. The formulary used for
matching ships with the extension (see below); the medication URL is built from a path, the search
fallback is a plain search link, and both open only when the user clicks.

## Matching

A CB1 title and a MedBud slug are both reduced to tokens with weights, product forms and irradiation
words removed. A candidate is rejected outright when:

- its potency codes disagree (`t30` vs `t25`) - the single most discriminating field;
- its product code disagrees (`acb` vs `hcb`), where a prefix counts as agreement because MedBud
  sometimes drops a suffix, listing `XK` for CB1's `XK-S`;
- it shares no strain word with the title;
- its slug carries no identifying tokens at all. MedBud has entries as bare as
  `/strains/all-nations/t28/`, which would otherwise match any product from that brand at that potency.

Survivors are scored by the harmonic mean of how much of the title the candidate covers and how much of
the candidate the title covers. This is symmetric like Jaccard but tolerates MedBud slugs that
abbreviate a longer CB1 name - `/strains/wellford/t25-mac/` for `Wellford Luma MAC T25 Miracle Alien
Cookies #3`, which Jaccard scored below threshold.

Matching runs twice. The first pass is the rules above, with potency required. Only if that finds
nothing does a second pass allow the potencies to differ - because CB1 labels the batch it is selling
while MedBud names the medication once, so CB1's `Greyscales JFRO T23 Jack Frosted` is MedBud's
`jfro-t24-jack-frosted`. Measured against a live browse page this is worth about eight points of match
rate, 75% to 83%.

The relaxed pass is deliberately narrow, because a looser first attempt produced two confident wrong
matches against real stock: `Papers RS-ELV T24 RS-11` landed on Doja's `rs-11`, and `All Nations MD T22
MAC Daddy` on `t27-mac-doughnut`. It therefore requires the brand to agree *and* every strain word of
the candidate to appear in the title - so only the potency is ever forgiven. Both wrong matches are
regression tests. Where MedBud lists several potencies of one medication the exact one still wins,
since the first pass runs first, and ties break towards the nearest potency.

One shortcut sits above the scoring: if both sides collapse to an identical run of characters they are
the same product. CB1 writes `L.A. S.A.G.E.` where MedBud writes `la-sage`; these tokenise completely
differently but both compact to `ipslast26lasage`.

## Why the formulary is bundled

Measured against a live browse page, matching the shipped snapshot resolves roughly a third of current
stock to an exact page. That is not a matcher defect: the snapshot ages, CB1 rotates stock constantly,
and MedBud renames medications - CB1's `Aurora Pedanios SRD T29 Sourdough` lives at
`/strains/aurora-pedanios/pedanios-t29/`, a slug carrying neither the product code (`SRD`) nor the
strain name (`sourdough`). Loosening the matcher to catch that would start producing wrong matches, and
a wrong rating on a medicine is worse than none.

So an unmatched product links to a search restricted to MedBud instead. Every card therefore leads
somewhere, the matcher stays strict, and the case it cannot solve is handled by the thing that solves
it well. The tiers are: confident match → the medication's page; anything else → a search.

Refreshing the formulary means shipping a new version of the extension. That is a deliberate trade:
fetching it at runtime is what Cloudflare refuses, and a stale snapshot plus a search fallback works,
where a live index works not at all.

## The shared mapping

Every patient sees the same catalogue, so resolving a medication is not per-user work.
`product-mapping.js` holds a name-to-medication mapping that ships with the extension and optionally
refreshes from a URL once a day. One resolution serves everybody.

The mapping and formulary target the *orderable* catalogue - around 84 products across the four tabs at
the time of writing. The scanner surfaces more than that (out-of-stock and over-limit products get a
badge too), and those extra, browse-only products are mostly not in the mapping, so they fall back to
search. That is fine: they cannot be ordered, so a one-hop search on a card you are only looking at
costs nothing worth spending an index entry on.

This is the tier that scales. A per-user search key does not survive a public release: users will not
obtain one, and a key embedded in the extension is extracted immediately and billed to whoever shipped
it. With a shared mapping, the client makes one small request a day regardless of how many cards are on
screen, and the lookup volume is bounded by how fast CB1's catalogue turns over - a few hundred new
medications a year across the entire userbase - rather than by user count.

The mapping only carries what the matcher cannot resolve, since anything the formulary already places
needs no entry. Remote entries override bundled ones per key, so a wrong link can be corrected without
shipping a new version, and anything the remote omits still resolves from the bundled copy. A remote
mapping that parses to nothing usable is refused rather than allowed to blank the bundled one, and
every path is validated before use - a mapping is remote input, and a bad entry would put a card on the
wrong medication.

Resolution order is cheapest-first: shared mapping, then the local matcher, then a search on hover.

This is what covers the non-flower tabs. The shipped formulary is scraped from `/strains/`, which is
flower only, so the matcher resolves almost nothing on the vape, oil and pastille tabs - MedBud files
those under `/vape-cartridges/`, `/oils/` and `/edibles/`, and their ratio-named products (`T200:C200`,
`T10:C10`) tokenise differently from the merged slugs MedBud uses (`t200c200`, `t10c10`). Rather than
teach the matcher three more naming schemes and a ratio grammar - risky, on a medicine - those tabs are
covered by mapping entries, each verified against MedBud's own section index page. Path validation
accepts all four sections. Across the orderable catalogue this takes direct-link coverage from
42% to 90%; the remainder are renames, generic slugs and a few products MedBud has not listed, which
fall back to search.

## Resolving the rest

Roughly one card in six is a medication the formulary cannot place - renamed, or listed since the
snapshot. Those link to a search scoped to MedBud (`shared/medbud-link.js`), because a search engine
handles a rename no matcher can: CB1's `Aurora Pedanios SRD T29 Sourdough` is MedBud's
`/strains/aurora-pedanios/pedanios-t29/`, a slug with neither the product code nor the strain name in
it. Nothing is fetched - a link is offered - so no key, permission or quota is involved. The card looks
identical to a directly-resolved one; only the href differs.

(An earlier version resolved these to exact pages on hover through the Brave Search API, behind a
user-supplied key. It was removed for release: almost no user obtains a key, the extra host permission
invited scrutiny, and the plain search fallback covers the case perfectly well.)

## Testing

The scoring and mapping are pure functions and are tested directly. `card-scanner.js` is not: it
needs a DOM, and it is also the module most exposed to a portal reskin, so it is tested against
the real card grid rather than hand-written markup that would drift from the site.

`linkedom` supplies the DOM. It was chosen over `jsdom` because these tests only need
`querySelectorAll`, `contains` and attributes; jsdom brings a much larger dependency tree for
spec areas - layout, events, navigation - that never come up here. It is a `devDependency`; the
extension itself still ships with no runtime dependencies.

The scanner matches the title by comparing element text, not by building a selector from the product
name, so an awkward name - a leading digit, a colon, a `#`, an accent - needs no escaping and cannot
break the scan. (An earlier version did build a `[aria-label="…"]` selector and needed `CSS.escape`;
keying off the image and comparing title text removed that whole class of fragility.)

### Fixtures

`tests/fixtures/cb1-*-grid.html` are the real card grids from all four portal tabs, extracted from
saved pages by `tools/make-card-fixture.mjs`. Regenerate one by saving that tab and re-running the tool
with a fixture name. All four are covered because carts and oils are named quite differently to flower
(`T800`, `25:25`) and their cards are not guaranteed to share markup - the scanner reads every card on
each (128 / 56 / 54 / 2 at the time of writing), over-limit and out-of-stock included.

A page saved from now on is saved with the extension running, so the tool also strips this extension's
own badges and `data-medbud-product` attributes (and title-link wrappers, from pages saved in the
version that added them). Without that the scanner tests would read output they produced themselves -
and a scanner run against an undecorated copy finds nothing at all, since a card already carrying its
product attribute is deliberately skipped.

The saved page is a **patient** page: it carries the account holder's name and their live prescription
balances. Only the grid subtree is copied, which leaves that data behind, and the tool refuses to write
a fixture that still matches any of it. Do not commit a raw saved page.

`medbud-rating-fragment.html` is a trimmed capture of a live medication page. The parser produces
identical output on the trimmed fragment and on the full 2.5 MB page, including the `{0,600}` window on
the aggregate block, so the trimming does not flatter it.

## Caching

| Data | TTL | Reason |
| --- | --- | --- |
| Successful match | 12 h | Product identity does not change. |
| Failed match | 1 h | The likeliest cause is a medication MedBud has only just listed. |

Cache entries live under a `cache:` prefix in `chrome.storage.local` so they can be cleared without
touching settings, which live in `chrome.storage.sync`. The match cache key carries a resolution
version, so improving the matcher or the mapping retires every entry from the old logic at once. The
tokenised form of the bundled formulary is memoised in the service worker for its lifetime.

