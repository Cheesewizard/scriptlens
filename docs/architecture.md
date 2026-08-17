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
| `background/request-queue.js` | Caps concurrent outbound requests. |
| `background/http-cache.js` | TTL cache over `chrome.storage.local`. |
| `content/card-scanner.js` | Locates product cards and their titles. |
| `content/rating-badge.js` | Builds and updates the badge DOM. |
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

One shortcut sits above the scoring: if both sides collapse to an identical run of characters they are
the same product. CB1 writes `L.A. S.A.G.E.` where MedBud writes `la-sage`; these tokenise completely
differently but both compact to `ipslast26lasage`.

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
