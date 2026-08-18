// Regenerates src/data/medbud-index.json from a saved copy of MedBud's
// medication index ("Save page as…" on https://medbud.wiki/strains/).
//
//   node tools/make-formulary.mjs "~/Downloads/All Bud Flower • MedBud UK.html"
//
// The formulary ships with the extension because MedBud's bot protection
// refuses background fetches, so refreshing it is a manual step: browse to the
// page yourself, save it, run this. Nothing here talks to MedBud.
//
// A bigger formulary means more products resolve to their exact page instead of
// falling back to a search, so this is worth re-running when the match rate on a
// browse page starts looking thin.
import { readFileSync, writeFileSync } from "node:fs";

// Medication pages live at /strains/<brand>/<product>/. Brand landing pages have
// a single path segment and are excluded by requiring both. Kept in step with
// the same pattern in src/background/medbud-index.js.
const PRODUCT_LINK_PATTERN = /href="(?:https:\/\/medbud\.wiki)?(\/strains\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\/)"/gi;

const OUTPUT_PATH = new URL("../src/data/medbud-index.json", import.meta.url);

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("usage: node tools/make-formulary.mjs <saved-strains-page.html>");

const html = readFileSync(sourcePath, "utf8");
const paths = new Set();

for (const match of html.matchAll(PRODUCT_LINK_PATTERN)) paths.add(match[1].toLowerCase());

if (paths.size === 0) throw new Error("no medication links found - is this the /strains/ page, and did it finish loading before it was saved?");

const previous = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
const sorted = [...paths].sort();

// A saved page that only captured part of the list would silently shrink the
// formulary and quietly cost matches, so shrinking is refused rather than warned.
if (sorted.length < previous.length)
{
	throw new Error(`refusing to write: ${sorted.length} medications found, fewer than the ${previous.length} already shipped. Was the whole list loaded before saving?`);
}

writeFileSync(OUTPUT_PATH, `${JSON.stringify(sorted, null, "\t")}\n`, "utf8");

const added = sorted.filter((path) => !previous.includes(path));

console.log(`wrote ${sorted.length} medications (${added.length} new, was ${previous.length})`);
for (const path of added.slice(0, 20)) console.log(`  + ${path}`);
if (added.length > 20) console.log(`  … and ${added.length - 20} more`);
