# Chrome Web Store listing - Strain Inspector

Paste-ready copy for the Web Store submission. Update here, then re-paste, when the listing changes.

## Name

```
Strain Inspector
```

## Summary (max 132 characters)

```
Adds MedBud patient-review and Leafly strain-profile links to every medication on the CB1 Medical portal.
```

## Category

Productivity

## Language

English (UK)

## Detailed description

```
Strain Inspector adds a link to patient reviews and strain information next to every medication on the
CB1 Medical patient portal - so you can check what other patients think of a product without opening
a second tab and searching for it by hand.

WHAT IT DOES
• On every product card, a "View on MedBud" link takes you straight to that medication's page on
  MedBud.wiki, the UK patient-review community.
• On flower, a second "Leafly" link opens the strain's terpene and effect profile.
• Works on all four tabs - flower, oils, vapes and pastilles - and on every product, including ones
  that are out of stock or over your prescription limit.

HOW IT WORKS
Strain Inspector ships with a snapshot of MedBud's medication list and matches each product locally. A product
it recognises links straight to that medication's MedBud page. Any that fail to match - a renamed or
newly listed product - fall back to a Google search query for the product instead of a direct link,
which still lands you on the right page. Nothing is scraped: it only ever offers you a link.

PRIVATE BY DESIGN
Strain Inspector runs entirely in your browser. There is no account, no analytics, no tracking, and no server.
It never reads, stores or transmits your name, your prescription, your allowances or your order history.
It only reads the public name of the medication shown on a card, and only to build a link. Full privacy
policy: https://github.com/Cheesewizard/strain-inspector/blob/main/PRIVACY.md

NOT MEDICAL ADVICE
Strain Inspector surfaces publicly available patient opinions and strain information. It is not medical advice,
and it is not affiliated with or endorsed by CB1 Medical, MedBud or Leafly. Decisions about your
medication belong with your prescriber.

Free and open source: https://github.com/Cheesewizard/strain-inspector
Support development: https://github.com/sponsors/Cheesewizard
```

## Support URL (listing field)

```
https://github.com/sponsors/Cheesewizard
```

## Privacy practices tab

**Single purpose**

```
Strain Inspector adds links to patient reviews (MedBud) and strain profiles (Leafly) for the medications shown
on the CB1 Medical patient portal, so the user can research a product without leaving the page.
```

**Permission justifications**

- `storage`
  ```
  Stores the user's settings and a local cache of resolved links, so the extension does not recompute
  them on every page load. This data stays in the browser and is never transmitted.
  ```
- Host permission `https://patient.cb1medical.com/*`
  ```
  The extension runs only on the CB1 Medical portal. It reads the product name each card already exposes
  in its accessibility label and adds the review/profile links. This is the extension's entire function,
  and the only site it requests.
  ```

**Remote code:** No, it does not use remote code.

**Data collection:** Strain Inspector does not collect or use any user data.

## Screenshots (need 1–5, 1280×800 or 640×400 PNG)

A ready-made illustration ships in this repo if you'd rather not photograph a logged-in page:
`docs/preview.svg` (vector source) plus `docs/preview-1280x800.png` and `docs/preview-640x400.png`
(store-sized, upload-ready). It shows the **View on MedBud** and **Leafly** links on a synthetic sample
card, so it exposes no name, prescription or allowance data.

For real screenshots, capture these yourself on a browse page (the portal needs a login):

1. A browse grid with several cards showing the **View on MedBud** and **Leafly** links - the core value, one glance.
2. A close-up of a single card with the links.
3. The settings page.

Blur or crop out the header (your name) and the allowance bar (your prescription balances) before
uploading - same reason the fixtures strip them.
