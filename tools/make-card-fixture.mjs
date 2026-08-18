// Regenerates a card fixture from a page saved out of the portal
// ("Save page as… / Web page, complete").
//
//   node tools/make-card-fixture.mjs "~/Downloads/Browse - CB1 Medical.html"
//   node tools/make-card-fixture.mjs "~/Downloads/vape - CB1 Medical.html" cb1-vape-grid.html
//
// The saved page is a *patient* page: it carries the account holder's name and
// their live prescription balances. Only the product cards are copied - each
// card is the tightest element holding both a product image and its title - so
// the surrounding page, where the patient data lives, is left behind entirely.
// The result is still checked for that data before being written. Never commit
// the raw saved page.
import { readFileSync, writeFileSync } from "node:fs";
import { parseHTML } from "linkedom";

import { findProductCards } from "../src/content/card-scanner.js";

const DEFAULT_OUTPUT_NAME = "cb1-browse-grid.html";

// Belt and braces: cards should never contain these, but refuse to write if one
// slips through.
const PATIENT_DATA_PATTERNS = [
	/Good (morning|afternoon|evening)/i,
	/\bmenu"/i,
	/Prescription Limits/i,
	/allowance/i,
	/\d+(\.\d+)?\s*(g|ml|pastilles)\s*left/i
];

const [, , sourcePath, outputName = DEFAULT_OUTPUT_NAME] = process.argv;
if (!sourcePath) throw new Error("usage: node tools/make-card-fixture.mjs <saved-page.html> [fixture-name.html]");

const OUTPUT_PATH = new URL(`../tests/fixtures/${outputName}`, import.meta.url);

// Content scripts read a global `document`, and CSS.escape is no longer used by
// the scanner, so a bare document is enough for the shared code to run here.
const { document } = parseHTML(readFileSync(sourcePath, "utf8"));
globalThis.document = document;

// A page saved while this extension was running carries its own badges and
// data-medbud-product attributes. Strip them from the whole document *before*
// scanning - the scanner skips a card already carrying its product attribute
// (the recycle guard), so leaving them on would drop every decorated card,
// which is exactly the addable ones.
for (const style of document.querySelectorAll("style")) style.remove();
for (const badge of document.querySelectorAll(".medbud-badge")) badge.remove();
for (const decorated of document.querySelectorAll("[data-medbud-product]")) decorated.removeAttribute("data-medbud-product");

const cards = findProductCards(document).map(({ card }) => card);
if (cards.length === 0) throw new Error("no product cards found - has the portal markup changed?");

const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>CB1 card fixture</title></head>
<body>
<div id="grid">
${cards.map((card) => card.outerHTML).join("\n")}
</div>
</body>
</html>
`;

const leaked = PATIENT_DATA_PATTERNS.filter((pattern) => pattern.test(html));
if (leaked.length > 0) throw new Error(`refusing to write: patient data matched ${leaked.join(", ")}`);

writeFileSync(OUTPUT_PATH, html, "utf8");

console.log(`wrote ${cards.length} cards, ${Buffer.byteLength(html, "utf8")} bytes`);
