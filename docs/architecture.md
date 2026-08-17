# Architecture

## Why the work is split across contexts

Content scripts cannot make cross-origin requests under the extension's host permissions — since
Chrome 85 those fetches are subject to the page's CORS rules. Every MedBud request therefore runs in
the service worker, and the content script only ever talks to it over `chrome.runtime.sendMessage`.

MV3 also refuses to load a content script as an ES module from the manifest. `src/content/loader.js`
is a classic script whose only job is to dynamically import `main.js`, which lets the rest of the
content-side code use normal imports. That is why `src/content/*.js` and `src/shared/*.js` are listed
in `web_accessible_resources`.

## Modules

| Module | Responsibility |
| --- | --- |
| `background/service-worker.js` | Message routing only. |
| `background/rating-service.js` | Orchestrates match then rating lookup, de-duplicates in-flight titles. |
| `background/medbud-index.js` | Fetches and caches the list of MedBud medication page paths. |
| `background/medbud-product.js` | Fetches a single medication page and reads its rating. |
| `background/product-matcher.js` | Pure functions: tokenising and scoring. No I/O, so it is directly testable. |
| `background/request-queue.js` | Caps concurrent outbound requests. |
| `background/http-cache.js` | TTL cache over `chrome.storage.local`. |
| `content/card-scanner.js` | Locates product cards and their title elements. |
| `content/rating-badge.js` | Builds and updates the badge DOM. |
| `content/main.js` | Scanning loop and mutation observer. |

## Parsing decisions

**MedBud is parsed as text, not as a DOM.** Service workers have no `DOMParser`, and the alternatives
(an offscreen document, or shipping multi-megabyte HTML over the message channel to the content script)
both cost more than they're worth for two extractions:

- the index needs anchor `href`s matching `/strains/<brand>/<product>/`
- a product page needs the numbers next to the words `Average`, `Rating` and `Review`

Reading by wording rather than by class name also survives a restyle of the MedBud page, which a CSS
selector would not.

**The CB1 portal is parsed by shape, not by class.** The portal ships hashed class names, so a card is
found by walking up from an "Add to Cart" control to the nearest ancestor that also contains a potency
code and a price. The title is then the shortest descendant text that contains a potency code but no
price and no percentage — which is the title node rather than one of its wrappers.

## Caching and TTLs

| Data | TTL | Reason |
| --- | --- | --- |
| Medication index | 24 h | Roughly one new product per day across the whole UK market. |
| Product rating | 12 h | Ratings accumulate slowly. |
| Successful match | 24 h | Tied to the index it was derived from. |
| Failed match | 6 h | Retried sooner in case the product was newly listed. |

All entries live under a `cache:` key prefix in `chrome.storage.local` so the options page can clear
them without touching settings, which live in `chrome.storage.sync`.
