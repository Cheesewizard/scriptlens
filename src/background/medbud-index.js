import { readCached, writeCached } from "./http-cache.js";
import { debug } from "../shared/logging.js";

const INDEX_URL = "https://medbud.wiki/strains/";
const INDEX_CACHE_KEY = "medbud-index";
const INDEX_TTL_MS = 24 * 60 * 60 * 1000;

// Medication pages live at /strains/<brand>/<product>/. Brand landing pages have
// a single path segment and are excluded by requiring both segments.
const PRODUCT_LINK_PATTERN = /href="(?:https:\/\/medbud\.wiki)?(\/strains\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\/)"/gi;

export async function loadProductIndex()
{
	const cached = await readCached(INDEX_CACHE_KEY);
	if (cached) return cached;

	const paths = await fetchProductPaths();

	await writeCached(INDEX_CACHE_KEY, paths, INDEX_TTL_MS);
	debug(`indexed ${paths.length} MedBud medication pages`);

	return paths;
}

async function fetchProductPaths()
{
	// Credentials are included so that a logged-in MedBud session is honoured;
	// MedBud has announced that some data will move behind a login.
	const response = await fetch(INDEX_URL, { credentials: "include" });
	if (!response.ok) throw new Error(`MedBud index request failed with status ${response.status}`);

	const html = await response.text();
	const paths = new Set();

	for (const match of html.matchAll(PRODUCT_LINK_PATTERN))
	{
		paths.add(match[1].toLowerCase());
	}

	if (paths.size === 0) throw new Error("MedBud index contained no medication links; the page markup has changed");

	return [...paths];
}
