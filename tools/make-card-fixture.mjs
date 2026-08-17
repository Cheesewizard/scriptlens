// Regenerates tests/fixtures/cb1-browse-grid.html from a page saved out of the
// portal ("Save page as… / Web page, complete").
//
//   node tools/make-card-fixture.mjs "~/Downloads/Browse - CB1 Medical.html"
//
// The saved page is a *patient* page: it carries the account holder's name and
// their live prescription balances. Only the card grid is copied into the
// fixture, which leaves that data behind, and the result is checked for it
// before being written. Never commit the raw saved page.
import { readFileSync, writeFileSync } from "node:fs";
import { parseHTML } from "linkedom";

const ADD_BUTTON_SELECTOR = "button[aria-label^='Add '][aria-label$=' to request']";
const OUTPUT_PATH = new URL("../tests/fixtures/cb1-browse-grid.html", import.meta.url);

// Anything that would mean patient data had leaked through into the grid.
const PATIENT_DATA_PATTERNS = [
	/Good (morning|afternoon|evening)/i,
	/\bmenu"/i,
	/Prescription Limits/i,
	/allowance/i,
	/\d+(\.\d+)?\s*(g|ml|pastilles)\s*left/i
];

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("usage: node tools/make-card-fixture.mjs <saved-page.html>");

const { document } = parseHTML(readFileSync(sourcePath, "utf8"));

const buttons = [...document.querySelectorAll(ADD_BUTTON_SELECTOR)];
if (buttons.length === 0) throw new Error("no add-to-request buttons found — has the portal markup changed?");

const grid = ancestorsOf(buttons[0]).find((candidate) => buttons.every((button) => candidate.contains(button)));
if (!grid) throw new Error("no common ancestor for the cards");

// Dark Reader and similar extensions inject large style blocks into saved pages.
for (const style of grid.querySelectorAll("style")) style.remove();

const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>CB1 browse grid fixture</title></head>
<body>
${grid.outerHTML}
</body>
</html>
`;

const leaked = PATIENT_DATA_PATTERNS.filter((pattern) => pattern.test(html));
if (leaked.length > 0) throw new Error(`refusing to write: patient data matched ${leaked.join(", ")}`);

writeFileSync(OUTPUT_PATH, html, "utf8");

console.log(`wrote ${buttons.length} cards, ${Buffer.byteLength(html, "utf8")} bytes`);

function ancestorsOf(element)
{
	const chain = [];

	for (let node = element; node; node = node.parentElement) chain.push(node);

	return chain;
}
