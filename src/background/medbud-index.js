import { readCached, writeCached } from "./http-cache.js";
import { fetchMedBudText } from "./medbud-request.js";
import { describeCandidate } from "./product-matcher.js";
import { debug } from "../shared/logging.js";

const INDEX_URL = "https://medbud.wiki/strains/";
const BUNDLED_INDEX_PATH = "src/data/medbud-index.json";
const INDEX_CACHE_KEY = "medbud-index";

// New medications are listed constantly, so a fetched index is short-lived.
// Only relevant when live lookups are enabled; the bundled formulary never
// expires, because refreshing it means shipping a new version.
export const INDEX_TTL_MS = 6 * 60 * 60 * 1000;

// Medication pages live at /strains/<brand>/<product>/. Brand landing pages have
// a single path segment and are excluded by requiring both.
const PRODUCT_LINK_PATTERN = /href="(?:https:\/\/medbud\.wiki)?(\/strains\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\/)"/gi;

// Tokenising 1,200 paths is wasted work on every lookup, so the parsed form is
// held for the life of the service worker and rebuilt whenever the paths change.
let describedCache = null;
let bundledCache = null;

export async function loadIndex({ forceRefresh = false, live = false } = {})
{
	if (!live) return loadBundledIndex();

	const cached = forceRefresh ? null : await readCached(INDEX_CACHE_KEY);
	if (cached) return cached;

	const paths = await fetchProductPaths();
	const index = { paths, fetchedAt: Date.now(), bundled: false };

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

	return { candidates: describedCache.candidates, fetchedAt: index.fetchedAt, bundled: index.bundled };
}

// The formulary ships with the extension, so matching costs no network at all.
// MedBud is behind bot mitigation that refuses background fetches outright, and
// a snapshot that resolves most products beats a live index that resolves none.
async function loadBundledIndex()
{
	if (bundledCache) return bundledCache;

	const response = await fetch(chrome.runtime.getURL(BUNDLED_INDEX_PATH));
	if (!response.ok) throw new Error(`bundled MedBud formulary could not be read (status ${response.status})`);

	const paths = await response.json();

	// A fixed timestamp keeps the described-candidate memo stable across calls.
	bundledCache = { paths, fetchedAt: 0, bundled: true };

	debug(`loaded ${paths.length} medications from the bundled formulary`);

	return bundledCache;
}

async function fetchProductPaths()
{
	const html = await fetchMedBudText(INDEX_URL, { label: "the medication index" });
	const paths = new Set();

	for (const match of html.matchAll(PRODUCT_LINK_PATTERN))
	{
		paths.add(match[1].toLowerCase());
	}

	if (paths.size === 0) throw new Error("MedBud index contained no medication links; the page markup has changed");

	return [...paths];
}
