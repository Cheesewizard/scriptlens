import { readCached, writeCached } from "./http-cache.js";
import { describeCandidate } from "./product-matcher.js";
import { debug } from "../shared/logging.js";

const INDEX_URL = "https://medbud.wiki/strains/";
const INDEX_CACHE_KEY = "medbud-index";

// New medications are listed constantly, so the index is short-lived. It costs a
// single request, and a miss can force a refresh sooner (see rating-service).
export const INDEX_TTL_MS = 6 * 60 * 60 * 1000;

// Medication pages live at /strains/<brand>/<product>/. Brand landing pages have
// a single path segment and are excluded by requiring both.
const PRODUCT_LINK_PATTERN = /href="(?:https:\/\/medbud\.wiki)?(\/strains\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\/)"/gi;

// Tokenising 1,200 paths is wasted work on every lookup, so the parsed form is
// held for the life of the service worker and rebuilt whenever the paths change.
let describedCache = null;

export async function loadIndex({ forceRefresh = false } = {})
{
	const cached = forceRefresh ? null : await readCached(INDEX_CACHE_KEY);
	if (cached) return cached;

	const paths = await fetchProductPaths();
	const index = { paths, fetchedAt: Date.now() };

	await writeCached(INDEX_CACHE_KEY, index, INDEX_TTL_MS);
	debug(`indexed ${paths.length} MedBud medication pages`);

	return index;
}

export async function loadCandidates(options)
{
	const index = await loadIndex(options);

	if (describedCache?.fetchedAt !== index.fetchedAt)
	{
		describedCache = { fetchedAt: index.fetchedAt, candidates: index.paths.map(describeCandidate) };
	}

	return { candidates: describedCache.candidates, fetchedAt: index.fetchedAt };
}

async function fetchProductPaths()
{
	// Credentials are included so a signed-in MedBud session is honoured; MedBud
	// has announced that some data is moving behind a login.
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
