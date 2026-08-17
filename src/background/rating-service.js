import { readCached, writeCached } from "./http-cache.js";
import { loadCandidates } from "./medbud-index.js";
import { loadProductRating } from "./medbud-product.js";
import { findBestMatch } from "./product-matcher.js";
import { enqueue } from "./request-queue.js";
import { loadSettings } from "../shared/settings.js";
import { debug } from "../shared/logging.js";

const MATCH_TTL_MS = 12 * 60 * 60 * 1000;

// A product CB1 lists but MedBud has not indexed yet is retried soon, because a
// newly released strain is exactly the case this needs to recover from quickly.
const UNMATCHED_TTL_MS = 60 * 60 * 1000;

// If nothing matches and the index has aged at all, the index is refetched once
// before the miss is accepted. Without this a strain added to MedBud today would
// stay invisible until the cached index expired on its own.
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
	const match = await resolveMatch(productName);

	if (!match.path)
	{
		debug(`no MedBud match for "${productName}"`);
		return { productName, matched: false };
	}

	const rating = await loadProductRating(match.path);

	return { productName, matched: true, matchScore: match.score, ...rating };
}

async function resolveMatch(productName)
{
	const cacheKey = `match:${productName}`;
	const cached = await readCached(cacheKey);
	if (cached) return cached;

	const { minimumMatchScore } = await loadSettings();
	const index = await loadCandidates();

	let match = findBestMatch(productName, index.candidates, minimumMatchScore);

	if (match === null && Date.now() - index.fetchedAt > REFRESH_ON_MISS_AFTER_MS)
	{
		debug(`refreshing MedBud index after a miss on "${productName}"`);

		const refreshed = await loadCandidates({ forceRefresh: true });
		match = findBestMatch(productName, refreshed.candidates, minimumMatchScore);
	}

	const resolved = match ?? { path: null, score: 0 };
	await writeCached(cacheKey, resolved, resolved.path ? MATCH_TTL_MS : UNMATCHED_TTL_MS);

	return resolved;
}
