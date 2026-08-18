import { readCached, writeCached } from "./http-cache.js";
import { loadCandidates } from "./medbud-index.js";
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

// A product CB1 lists but the formulary does not is worth retrying sooner than a
// confident match, since a newly listed medication is the likeliest cause.
const UNMATCHED_TTL_MS = 60 * 60 * 1000;

// The grid can redraw the same product into several cards at once, so identical
// in-flight lookups share a single promise.
const inFlightByProduct = new Map();

export function requestRating(productName)
{
	if (!productName) throw new Error("productName is required");

	const existing = inFlightByProduct.get(productName);
	if (existing) return existing;

	const lookup = enqueue(() => resolveProduct(productName)).finally(() => inFlightByProduct.delete(productName));
	inFlightByProduct.set(productName, lookup);

	return lookup;
}

// Resolves a product to where its MedBud page is, never fetching anything: the
// extension only ever offers a link. A confident match links to the exact page;
// anything else links to a search that finds a medication MedBud has renamed or
// listed since the bundled formulary was captured.
async function resolveProduct(productName)
{
	const { minimumMatchScore, mappingUrl } = await loadSettings();
	const match = await resolveMatch(productName, { minimumMatchScore, mappingUrl });

	if (!match.path)
	{
		debug(`no MedBud match for "${productName}"; falling back to search`);

		return { productName, matched: false, searchUrl: searchUrl(productName) };
	}

	return { productName, matched: true, matchScore: match.score, url: productUrl(match.path) };
}

async function resolveMatch(productName, { minimumMatchScore, mappingUrl })
{
	// The mapping is authoritative and cheap — held in memory after first load —
	// so it is consulted before the cache. A cached miss from before an entry was
	// added must never shadow it, which is exactly what browsing these tabs before
	// the mapping existed would otherwise cause.
	const mapped = await lookUpMapping(productName, mappingUrl);
	if (mapped !== null) return { path: mapped, score: 1 };

	// The version in the key retires every entry resolved by older logic: improve
	// the matcher or the formulary and a product that used to miss is re-evaluated
	// rather than served a stale miss until its TTL happens to lapse.
	const cacheKey = `match:${RESOLUTION_VERSION}:${productName}`;
	const cached = await readCached(cacheKey);
	if (cached) return cached;

	const { candidates } = await loadCandidates();
	const match = findBestMatch(productName, candidates, minimumMatchScore);

	const resolved = match ?? { path: null, score: 0 };
	await writeCached(cacheKey, resolved, resolved.path ? MATCH_TTL_MS : UNMATCHED_TTL_MS);

	return resolved;
}
