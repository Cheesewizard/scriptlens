import { readCached, writeCached } from "./http-cache.js";
import { loadProductIndex } from "./medbud-index.js";
import { loadProductRating } from "./medbud-product.js";
import { findBestMatch } from "./product-matcher.js";
import { enqueue } from "./request-queue.js";
import { loadSettings } from "../shared/settings.js";
import { debug } from "../shared/logging.js";

const MATCH_TTL_MS = 24 * 60 * 60 * 1000;
const UNMATCHED_TTL_MS = 6 * 60 * 60 * 1000;

// Several cards on a page can carry the same title once filters or tabs redraw
// the grid, so identical in-flight lookups share one promise.
const inFlightByTitle = new Map();

export function requestRating(title)
{
	if (!title) throw new Error("title is required");

	const existing = inFlightByTitle.get(title);
	if (existing) return existing;

	const lookup = enqueue(() => resolveRating(title)).finally(() => inFlightByTitle.delete(title));
	inFlightByTitle.set(title, lookup);

	return lookup;
}

async function resolveRating(title)
{
	const match = await resolveMatch(title);

	if (!match.path)
	{
		debug(`no MedBud match for "${title}"`);
		return { title, matched: false };
	}

	const rating = await loadProductRating(match.path);

	return { title, matched: true, matchScore: match.score, ...rating };
}

async function resolveMatch(title)
{
	const cacheKey = `match:${title}`;
	const cached = await readCached(cacheKey);
	if (cached) return cached;

	const settings = await loadSettings();
	const index = await loadProductIndex();
	const match = findBestMatch(title, index, settings.minimumMatchScore) ?? { path: null, score: 0 };

	await writeCached(cacheKey, match, match.path ? MATCH_TTL_MS : UNMATCHED_TTL_MS);

	return match;
}
