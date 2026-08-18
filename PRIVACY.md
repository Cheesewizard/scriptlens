# Privacy policy

**ScriptLens does not collect, store, or transmit any personal or medical data.** There is no analytics,
no tracking, no account, and no server that belongs to ScriptLens.

This is a short, plain-English policy for a tool that runs entirely in your browser.

## What it reads

On the CB1 Medical portal (`patient.cb1medical.com`), ScriptLens reads the **product name** shown on each
medication card — the text CB1 already puts in the page's accessibility labels. That is all it takes
from the page. It does **not** read, store, or transmit your name, your prescription, your allowances,
your order history, or anything else about you or your account.

## What leaves your browser, and where it goes

- **Nothing goes to a ScriptLens server, because there isn't one.**
- **ScriptLens never fetches anything** — it only ever builds links for you to click. When a product is
  not in the bundled data, the link is a web search built from the product name (a Google search scoped
  to MedBud, or to Leafly). Navigating there happens only when **you click** the link, exactly as if you
  had typed the name into a search box yourself.

No link ScriptLens builds carries any information about you — only the public name of a medication.

## What it stores

Your settings, and a cache of resolved links and index data, are kept in your browser's own extension
storage (`chrome.storage`). This never leaves your browser except through Chrome's own sync, if you have
that enabled for extensions. You can clear all cached data from the settings page at any time.

## Permissions

- **Storage** — to keep your settings and the link cache locally.
- **Access to `patient.cb1medical.com`** — the only site the extension runs on, to read product names
  and add the links. It requests no other site.

## Contact

Questions or concerns: open an issue at
<https://github.com/Cheesewizard/scriptlens>.
