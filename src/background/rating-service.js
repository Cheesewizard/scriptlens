import { readCached, writeCached } from "./http-cache.js";
import { loadCandidates } from "./medbud-index.js";
import { loadProductRating } from "./medbud-product.js";
import { lookUpMapping } from "./product-mapping.js";
import { findBestMatch } from "./product-matcher.js";
import { enqueue } from "./request-queue.js";
import { productUrl, searchUrl } from "../shared/medbud-link.js";
import { loadSettings } from "../shared/settings.js";
import { debug } from "../shared/logging.js";

const MATCH_TTL_MS = 12 * 60 * 60 * 1000;

// Bumped whenever matching, the formulary or the mapping changes, so a cached
// result from the old logic is never read back. Old entries expire on their own.
const RESOLUTION_VERSION = 2;

// A product CB1 lists but MedBud has not indexed yet is retried soon, because a
// newly released strain is exactly the case this needs to recover from quickly.
const UNMATCHED_TTL_MS = 60 * 60 * 1000;

// If nothing matches and the index has aged at all, the index is refetched once
// before the miss is accepted. Without this a strain added to MedBud today would
// stay invisible until the cached index expired on its own. Only meaningful for
// a live index; the bundled formulary cannot be refreshed at runtime.
const REFRESH_ON_MISS_AFTER_MS = 30 * 60 * 1000;

// The grid can redraw the same product into several cards at once, so identical
// in-flight lookups share a single promise.
const inFlightByProduct = new Map();

export function requestRating(productName)
{
	if (!productName) throw new Error("productName is required");

	const existing = inFlightByProduct.get(productName);
	if (existing) return existing;

	const lookup = enqueue(() => resolveRating(productName)).finally(() => inFlightByProduct.delete(productName));
	inFlightByProduct.set(productName, lookup);

	return lookup;
}

async function resolveRating(productName)
{
	const settings = await loadSettings();
	const match = await resolveMatch(productName, settings);

	// Every product gets somewhere to go. Without a confident match that is a
	// search, which is what finds a medication MedBud has renamed or listed since
	// the bundled formulary was captured.
	if (!match.path)
	{
		debug(`no MedBud match for "${productName}"; falling back to search`);

		return { productName, matched: false, searchUrl: searchUrl(productName) };
	}

	const url = productUrl(match.path);

	if (!settings.liveRatings) return { productName, matched: true, matchScore: match.score, url, ratingsFetched: false };

	const rating = await loadProductRating(match.path);

	return { productName, matched: true, matchScore: match.score, ratingsFetched: true, ...rating };
}

async function resolveMatch(productName, settings)
{
	// The mapping is authoritative and cheap — held in memory after first load —
	// so it is consulted before the cache. A cached miss from before an entry was
	// added must never shadow it, which is exactly what browsing these tabs before
	// the mapping existed would otherwise cause.
	const mapped = await lookUpMapping(productName, settings.mappingUrl);
	if (mapped !== null) return { path: mapped, score: 1 };

	// The version in the key retires every entry resolved by older logic: improve
	// the matcher or the formulary and a product that used to miss is re-evaluated
	// rather than served a stale miss until its TTL happens to lapse.
	const cacheKey = `match:${RESOLUTION_VERSION}:${productName}`;
	const cached = await readCached(cacheKey);
	if (cached) return cached;

	const index = await loadCandidates({ live: settings.liveRatings });

	let match = findBestMatch(productName, index.candidates, settings.minimumMatchScore);

	if (match === null && !index.bundled && Date.now() - index.fetchedAt > REFRESH_ON_MISS_AFTER_MS)
	{
		debug(`refreshing MedBud index after a miss on "${productName}"`);

		const refreshed = await loadCandidates({ live: true, forceRefresh: true });
		match = findBestMatch(productName, refreshed.candidates, settings.minimumMatchScore);
	}

	const resolved = match ?? { path: null, score: 0 };
	await writeCached(cacheKey, resolved, resolved.path ? MATCH_TTL_MS : UNMATCHED_TTL_MS);

	return resolved;
}
