# Architecture

## Why the work is split across contexts

Content scripts cannot make cross-origin requests under the extension's host permissions — since
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
| `background/rating-service.js` | Match then rating lookup, de-duplication, stale-index recovery. |
| `background/medbud-index.js` | Fetches, caches and pre-tokenises the medication index. |
| `background/medbud-product.js` | Reads one medication page's rating microdata. |
| `background/product-matcher.js` | Pure functions: tokenising and scoring. No I/O, so directly testable. |
| `background/medbud-request.js` | MedBud fetching, Cloudflare challenge detection and backoff. Only used when live ratings are enabled. |
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

So cards are found by the add button's label, and the card root is the nearest ancestor that also holds
the image labelled with the same product name — which validates the pairing rather than trusting a
fixed depth. The badge goes before the title element, identified by exact text equality with the name.

The grid recycles DOM nodes when filters or tabs change, so a decorated card can come back holding a
different product. Cards record which product they were decorated for in `data-medbud-product`, and a
result arriving after the node has been reused is discarded.

Navigation is the badge alone — a **View on MedBud** button (and, for flower, **Leafly**). The product
title was once a link too, but that duplicated the button and, on a search fallback, sent the name to a
Google search, so it was removed. The portal's title element is left untouched; the badge simply sits
before it.

## Leafly

Flower cards carry a second link, to the strain's Leafly terpene and effect profile, alongside the
MedBud review link. It is a different join: MedBud is matched on the product (the full SKU), Leafly on
the strain alone, pulled out of the product name — the words between the potency and the form, with the
pack and batch markers dropped (`shared/strain.js`). Only flower gets it, which is where a terpene
profile is what a buyer reaches for.

The link is a search, not a direct page, and deliberately so: Leafly's naming does not follow from a
CB1 name — its "White Fire" is `/strains/white-fire-og` — and there is no bundled Leafly index to
verify a slug against, so a guessed URL would 404 more often than not. A search scoped to
`leafly.com/strains` lands on the right strain instead. No fetch is made to Leafly; only a link is
offered, so its bot protection and terms are never engaged. This is the same shape as the whole
extension: join two sites through their most stable handle, link out, never scrape what is gated.

## Reading MedBud

MedBud emits schema.org microdata, which is more stable than either its visible wording or its CSS:

```html
<div id="review-aggregate-rating" itemprop="aggregateRating" itemscope
     itemtype="https://schema.org/AggregateRating">
  <meta itemprop="ratingValue" content="3.00">
  <meta itemprop="ratingCount" content="1">
  <meta itemprop="reviewCount" content="1">
</div>
```

Pages are parsed as text rather than as a DOM. Service workers have no `DOMParser`, and the
alternatives — an offscreen document, or shipping multi-megabyte HTML to the content script — cost more
than they are worth for reading a handful of `meta` attributes and one table.

The index is scraped from `/strains/` by matching anchors of the form `/strains/<brand>/<product>/`.
Single-segment paths are brand landing pages and are excluded.

## Matching

A CB1 title and a MedBud slug are both reduced to tokens with weights, product forms and irradiation
words removed. A candidate is rejected outright when:

- its potency codes disagree (`t30` vs `t25`) — the single most discriminating field;
- its product code disagrees (`acb` vs `hcb`), where a prefix counts as agreement because MedBud
  sometimes drops a suffix, listing `XK` for CB1's `XK-S`;
- it shares no strain word with the title;
- its slug carries no identifying tokens at all. MedBud has entries as bare as
  `/strains/all-nations/t28/`, which would otherwise match any product from that brand at that potency.

Survivors are scored by the harmonic mean of how much of the title the candidate covers and how much of
the candidate the title covers. This is symmetric like Jaccard but tolerates MedBud slugs that
abbreviate a longer CB1 name — `/strains/wellford/t25-mac/` for `Wellford Luma MAC T25 Miracle Alien
Cookies #3`, which Jaccard scored below threshold.

Matching runs twice. The first pass is the rules above, with potency required. Only if that finds
nothing does a second pass allow the potencies to differ — because CB1 labels the batch it is selling
while MedBud names the medication once, so CB1's `Greyscales JFRO T23 Jack Frosted` is MedBud's
`jfro-t24-jack-frosted`. Measured against a live browse page this is worth about eight points of match
rate, 75% to 83%.

The relaxed pass is deliberately narrow, because a looser first attempt produced two confident wrong
matches against real stock: `Papers RS-ELV T24 RS-11` landed on Doja's `rs-11`, and `All Nations MD T22
MAC Daddy` on `t27-mac-doughnut`. It therefore requires the brand to agree *and* every strain word of
the candidate to appear in the title — so only the potency is ever forgiven. Both wrong matches are
regression tests. Where MedBud lists several potencies of one medication the exact one still wins,
since the first pass runs first, and ties break towards the nearest potency.

One shortcut sits above the scoring: if both sides collapse to an identical run of characters they are
the same product. CB1 writes `L.A. S.A.G.E.` where MedBud writes `la-sage`; these tokenise completely
differently but both compact to `ipslast26lasage`.

## Why the formulary is bundled

Measured against a live browse page, matching the shipped snapshot resolves roughly a third of current
stock to an exact page. That is not a matcher defect: the snapshot ages, CB1 rotates stock constantly,
and MedBud renames medications — CB1's `Aurora Pedanios SRD T29 Sourdough` lives at
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

Every patient sees the same catalogue — 84 products across the portal's four tabs at the time of
writing — so resolving a medication is not per-user work. `product-mapping.js` holds a
name-to-medication mapping that ships with the extension and optionally refreshes from a URL once a
day. One resolution serves everybody.

This is the tier that scales. A per-user search key does not survive a public release: users will not
obtain one, and a key embedded in the extension is extracted immediately and billed to whoever shipped
it. With a shared mapping, the client makes one small request a day regardless of how many cards are on
screen, and the lookup volume is bounded by how fast CB1's catalogue turns over — a few hundred new
medications a year across the entire userbase — rather than by user count.

The mapping only carries what the matcher cannot resolve, since anything the formulary already places
needs no entry. Remote entries override bundled ones per key, so a wrong link can be corrected without
shipping a new version, and anything the remote omits still resolves from the bundled copy. A remote
mapping that parses to nothing usable is refused rather than allowed to blank the bundled one, and
every path is validated before use — a mapping is remote input, and a bad entry would put a card on the
wrong medication.

Resolution order is cheapest-first: shared mapping, then the local matcher, then a search on hover.

This is what covers the non-flower tabs. The shipped formulary is scraped from `/strains/`, which is
flower only, so the matcher resolves almost nothing on the vape, oil and pastille tabs — MedBud files
those under `/vape-cartridges/`, `/oils/` and `/edibles/`, and their ratio-named products (`T200:C200`,
`T10:C10`) tokenise differently from the merged slugs MedBud uses (`t200c200`, `t10c10`). Rather than
teach the matcher three more naming schemes and a ratio grammar — risky, on a medicine — those tabs are
covered by mapping entries, each verified against MedBud's own section index page. Path validation
accepts all four sections. Across the full 84-product catalogue this takes direct-link coverage from
42% to 90%; the remainder are renames, generic slugs and a few products MedBud has not listed, which
fall back to search.

## Resolving the rest

Roughly one card in six is a medication the formulary cannot place — renamed, or listed since the
snapshot. `link-resolver.js` finds those through a search API rather than a token match, because a
search engine handles a rename that no matcher can: CB1's `Aurora Pedanios SRD T29 Sourdough` is
MedBud's `/strains/aurora-pedanios/pedanios-t29/`, a slug with neither the product code nor the strain
name in it.

Brave's Search API is used rather than scraping a results page. Scraping Google is against its terms
and gets challenged within days, which is the same failure this project already hit from the other
direction. An API key is a real cost — the extension works without one, it just links to a search you
finish yourself.

**The search engine is queried, never MedBud.** MedBud is only ever opened by the user clicking the
resulting link, which is an ordinary navigation. Verified in Brave: resolving a product issues exactly
one request, to `api.search.brave.com`.

Resolution is triggered by hovering a card, not by page load. Forty cards resolved eagerly would spend
a day's quota on medications never looked at; hovering is a good signal of intent and buys most of the
round trip before the click. A click landing on an unfinished lookup opens the tab immediately — inside
the user gesture, so the popup blocker allows it — and points it at the medication when the lookup
returns, falling back to the search page after 800 ms. Results cache for a month, since a medication's
URL does not change; failures for a day, since the usual cause is MedBud not having listed it yet.

## Cloudflare

MedBud sits behind Cloudflare bot mitigation. A request from the service worker with no clearance gets
`403` with `cf-mitigated: challenge` and the "Security Check" interstitial, which asks for a click and
says in as many words that it is there to stop automated scraping and AI crawlers.

A background `fetch` cannot answer an interactive challenge. What makes the extension work at all is
that `credentials: "include"` carries the `cf_clearance` cookie the user's *ordinary browsing* of
MedBud already earned, so the extension rides on a human session rather than presenting as a bot. When
that cookie is absent or expired — a fresh profile, or a while since MedBud was last visited — every
lookup fails until the user opens MedBud in a tab.

That is a user-clearable state, not a bug, so it is reported as one. `medbud-request.js` detects the
challenge, throws a `MedBudChallengeError` carrying `CHALLENGED_CODE`, and the badge renders "MedBud
check needed" linking to MedBud instead of "lookup failed". The code travels as a field on the response
because an `Error` does not survive the structured clone across the message channel.

Detection prefers Cloudflare's `cf-mitigated` header — readable because extension fetches carry host
permissions and are not CORS-restricted — and falls back to sniffing the interstitial body, but only on
403 and 503, so an ordinary 403 is still reported as an ordinary 403.

Once challenged, the module fails fast for five minutes rather than sending one doomed request per
card: a grid of 23 cards otherwise produces 23 blocked requests against a site that is explicitly
asking for less automated load. That backoff is module state, so it resets when the MV3 worker is
evicted — which is the right default, since the next page load then re-probes whether the user has
cleared the challenge.

Worth knowing for the project's standing: MedBud's `robots.txt` disallows AI crawlers by name
(`ClaudeBot`, `GPTBot`, `OAI-SearchBot`, and others) but allows `*` on `/strains/`, which is what this
extension reads. The extension's access pattern — a signed-in human's browser, one index fetch per six
hours, cached ratings — is within that. Bulk or automated collection outside a user's own browsing
would not be.

## Testing

The scoring and microdata parsing are pure functions and are tested directly. `card-scanner.js` is not
— it needs a DOM — and it is also the module most exposed to a portal reskin, so it is tested against
the real card grid rather than hand-written markup that would drift from the site.

`linkedom` supplies the DOM. It was chosen over `jsdom` because these tests only need
`querySelectorAll`, `contains` and attributes; jsdom brings a much larger dependency tree for
spec areas — layout, events, navigation — that never come up here. It is a `devDependency`; the
extension itself still ships with no runtime dependencies.

linkedom does not implement `CSS`, which `card-scanner` uses to build its attribute selector, so
`tests/helpers/dom.mjs` installs the CSSOM-spec `CSS.escape` rather than an approximation — otherwise
the tests would exercise different escaping to production.

That escaping is load-bearing and worth not "simplifying" away. `CSS.escape` escapes for use as an
*identifier*, and the selector interpolates it inside a quoted attribute value, which looks wrong:

```
"4C Labs Core ACB T21 …"  ->  [aria-label="\34 C\ Labs\ Core\ ACB\ T21\ … image"]
"… Creamy Kees #5 …"      ->  [aria-label="…Creamy\ Kees\ \#5\ … image"]
```

CSS string escapes resolve those back to the original characters, so it matches — verified in Chrome
against all 23 cards, not just in linkedom. It also correctly escapes a `"` or `\` in a product name,
which is the case that would otherwise break the selector.

### Fixtures

`tests/fixtures/cb1-*-grid.html` are the real card grids from all four portal tabs, extracted from
saved pages by `tools/make-card-fixture.mjs`. Regenerate one by saving that tab and re-running the tool
with a fixture name. All four are covered because carts and oils are named quite differently to flower
(`T800`, `25:25`) and their cards are not guaranteed to share markup — the scanner reads all 84
products across the four tabs.

A page saved from now on is saved with the extension running, so the tool also strips this extension's
own badges and `data-medbud-product` attributes (and title-link wrappers, from pages saved in the
version that added them). Without that the scanner tests would read output they produced themselves —
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
| Medication index | 6 h | New medications are listed constantly. |
| Product rating | 6 h | Ratings move slowly, but a day-old average is not worth showing. |
| Successful match | 12 h | Product identity does not change; only its rating does. |
| Failed match | 1 h | The likeliest cause is a strain MedBud has not indexed yet. |

TTLs alone would still hide a strain added to MedBud shortly after an index fetch, so a failed match
against an index older than 30 minutes forces a refetch and one retry before the miss is accepted.

Cache entries live under a `cache:` prefix in `chrome.storage.local` so they can be cleared without
touching settings, which live in `chrome.storage.sync`. The tokenised form of the index is additionally
memoised in the service worker for its lifetime, keyed on the index fetch timestamp.
