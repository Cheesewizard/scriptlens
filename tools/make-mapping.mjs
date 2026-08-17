// Extends src/data/medbud-mapping.json — the shared name-to-medication mapping.
//
//   BRAVE_API_KEY=... node tools/make-mapping.mjs "~/Downloads/*.html"
//
// Reads product names out of saved CB1 pages, keeps the ones the bundled
// formulary cannot resolve, and looks those up through the search API. The
// result is committed and ships with the extension, so no user needs a key: the
// portal's catalogue is the same for every patient, and one resolution serves
// everybody.
//
// The search engine is queried, never MedBud.
import { readFileSync, writeFileSync } from "node:fs";

import { findBestMatch, describeCandidate } from "../src/background/product-matcher.js";
import { readProductPath } from "../src/background/link-resolver.js";

const MINIMUM_SCORE = 0.45;
const SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

// Brave's free tier is one query a second.
const SEARCH_INTERVAL_MS = 1200;

const FORMULARY_PATH = new URL("../src/data/medbud-index.json", import.meta.url);
const MAPPING_PATH = new URL("../src/data/medbud-mapping.json", import.meta.url);

const sources = process.argv.slice(2);
if (sources.length === 0) throw new Error("usage: [BRAVE_API_KEY=...] node tools/make-mapping.mjs <saved-cb1-page.html> [...]");

const candidates = JSON.parse(readFileSync(FORMULARY_PATH, "utf8")).map(describeCandidate);
const mapping = JSON.parse(readFileSync(MAPPING_PATH, "utf8"));
const apiKey = process.env.BRAVE_API_KEY ?? "";

const names = new Set();

for (const source of sources)
{
	for (const match of readFileSync(source, "utf8").matchAll(/aria-label="Add (.*?) to request"/g)) names.add(match[1]);
}

console.log(`${names.size} products across ${sources.length} page(s)`);

const unresolved = [...names].filter((name) => findBestMatch(name, candidates, MINIMUM_SCORE) === null);
const missing = unresolved.filter((name) => !(name in mapping.products));

console.log(`${names.size - unresolved.length} resolve locally, ${unresolved.length} need the mapping (${missing.length} not yet in it)`);

if (missing.length === 0)
{
	console.log("nothing to look up");
	process.exit(0);
}

if (!apiKey)
{
	console.log("\nSet BRAVE_API_KEY to look these up, or add them by hand:");
	for (const name of missing) console.log(`  ${name}`);
	process.exit(0);
}

let added = 0;

for (const name of missing)
{
	const path = await searchForPath(name);

	if (path === null)
	{
		console.log(`  ?  ${name}`);
		continue;
	}

	mapping.products[name] = path;
	added += 1;
	console.log(`  +  ${name}\n     ${path}`);

	await wait(SEARCH_INTERVAL_MS);
}

if (added > 0)
{
	mapping.products = Object.fromEntries(Object.entries(mapping.products).sort(([left], [right]) => left.localeCompare(right)));

	writeFileSync(MAPPING_PATH, `${JSON.stringify(mapping, null, "\t")}\n`, "utf8");
}

console.log(`\nadded ${added}; mapping now holds ${Object.keys(mapping.products).length}`);

async function searchForPath(productName)
{
	const url = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(`${productName} site:medbud.wiki`)}&count=5`;
	const response = await fetch(url, { headers: { "Accept": "application/json", "X-Subscription-Token": apiKey } });

	if (!response.ok) throw new Error(`search failed with status ${response.status} for "${productName}"`);

	for (const result of (await response.json())?.web?.results ?? [])
	{
		const path = readProductPath(result?.url);
		if (path) return path;
	}

	return null;
}

function wait(milliseconds)
{
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
