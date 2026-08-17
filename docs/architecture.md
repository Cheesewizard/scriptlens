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
| `background/medbud-request.js` | MedBud fetching, Cloudflare challenge detection and backoff. |
| `background/request-queue.js` | Caps concurrent outbound requests. |
| `background/http-cache.js` | TTL cache over `chrome.storage.local`. |
| `content/card-scanner.js` | Locates product cards and their titles. |
| `content/rating-badge.js` | Builds and updates the badge DOM. |
| `content/title-link.js` | Wraps the product title in a link to its MedBud page. |
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

The title itself becomes a link to the matched MedBud page. It is *wrapped* rather than rewritten: the
portal's own element, text and attributes are left alone, so React keeps the node it is holding, and
the wrapper is `display: contents` so it generates no box and the grid layout is unchanged (measured in
Chrome: zero delta on both the title and card bounding boxes). A real anchor is used instead of a click
handler so middle-click, the context menu and "open in new tab" all work; the click is stopped from
propagating because the whole card is clickable in the portal and the name should go to MedBud rather
than also opening the portal's product page. Recycled cards are unwrapped before redecorating, or a
card could point at the product it used to show.

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

`tests/fixtures/cb1-browse-grid.html` is the real card grid, extracted from a saved browse page by
`tools/make-card-fixture.mjs`. Regenerate it by saving the browse page and re-running that tool.

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
