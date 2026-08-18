# Privacy policy

**BudLens does not collect, store, or transmit any personal or medical data.** There is no analytics,
no tracking, no account, and no server that belongs to BudLens.

This is a short, plain-English policy for a tool that runs entirely in your browser.

## What it reads

On the CB1 Medical portal (`patient.cb1medical.com`), BudLens reads the **product name** shown on each
medication card — the text CB1 already puts in the page's accessibility labels. That is all it takes
from the page. It does **not** read, store, or transmit your name, your prescription, your allowances,
your order history, or anything else about you or your account.

## What leaves your browser, and where it goes

- **Nothing goes to a BudLens server, because there isn't one.**
- **Search fallback:** when a product is not in the bundled data, BudLens builds a web-search link from
  the product name (e.g. a Google search scoped to MedBud, or Leafly). The search only happens when
  **you click or hover** the link — the product name, and nothing else, forms the query. This is the
  same thing you would type into a search box yourself.
- **Optional direct resolution:** if you add your own Brave Search API key in the settings, BudLens
  sends a product name to `api.search.brave.com` (on hover) to find its exact page. This is off unless
  you provide a key, and only the product name is ever sent.
- **MedBud ratings (off by default):** the "Fetch ratings from MedBud" option, if you turn it on, would
  request medication pages from `medbud.wiki`. It is disabled by default and currently blocked by
  MedBud's own protection.

No request BudLens makes carries any information about you — only the public name of a medication.

## What it stores

Your settings, and a cache of resolved links and index data, are kept in your browser's own extension
storage (`chrome.storage`). This never leaves your browser except through Chrome's own sync, if you have
that enabled for extensions. You can clear all cached data from the settings page at any time.

## Permissions

- **Storage** — to keep your settings and the link cache locally.
- **Access to `patient.cb1medical.com`** — to read product names and add the links.
- **Access to `medbud.wiki`** — only used if you enable the off-by-default ratings option.
- **Access to `api.search.brave.com`** — only used if you add a search API key.

## Contact

Questions or concerns: open an issue at
<https://github.com/Cheesewizard/cb1-medbud-ratings>.
