import { readCached, writeCached } from "./http-cache.js";
import { MEDBUD_BASE_URL } from "../shared/medbud-link.js";
import { debug } from "../shared/logging.js";

const SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

// A medication's page URL does not change once it exists, so a resolved link is
// worth keeping. A failure is retried sooner, since it usually means MedBud has
// not listed the product yet rather than that it never will.
const RESOLVED_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const UNRESOLVED_TTL_MS = 24 * 60 * 60 * 1000;

// Only a medication page will do. Brand landing pages and MedBud's own articles
// are not what the card should link to.
const PRODUCT_URL_PATTERN = /^https:\/\/medbud\.wiki(\/strains\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\/)$/i;

// One resolution per product, however many cards ask for it. The grid can show
// the same medication more than once, and hovering re-enters constantly.
const inFlightByProduct = new Map();

export function resolveProductLink(productName, apiKey)
{
	if (!productName) throw new Error("productName is required");

	const existing = inFlightByProduct.get(productName);
	if (existing) return existing;

	const lookup = resolve(productName, apiKey).finally(() => inFlightByProduct.delete(productName));
	inFlightByProduct.set(productName, lookup);

	return lookup;
}

async function resolve(productName, apiKey)
{
	const cacheKey = `link:${productName}`;
	const cached = await readCached(cacheKey);
	if (cached) return cached;

	if (!apiKey) return { path: null, reason: "no-api-key" };

	const path = await searchForProductPath(productName, apiKey);
	const resolved = { path, reason: path ? null : "not-found" };

	await writeCached(cacheKey, resolved, path ? RESOLVED_TTL_MS : UNRESOLVED_TTL_MS);

	return resolved;
}

// Searching is what finds a medication the formulary cannot: one MedBud has
// renamed, or listed since the formulary was captured. The search engine is
// asked, not MedBud — MedBud is only ever visited by the user clicking through.
async function searchForProductPath(productName, apiKey)
{
	const url = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(`${productName} site:medbud.wiki`)}&count=5`;

	const response = await fetch(url, {
		headers: { "Accept": "application/json", "X-Subscription-Token": apiKey }
	});

	if (response.status === 401 || response.status === 403) throw new Error("The search API rejected the key. Check it in the extension's options.");
	if (response.status === 429) throw new Error("The search API rate limit was reached. Links will resolve again shortly.");
	if (!response.ok) throw new Error(`Search request failed with status ${response.status}`);

	const body = await response.json();
	const results = body?.web?.results ?? [];

	for (const result of results)
	{
		const path = readProductPath(result?.url);

		if (path)
		{
			debug(`resolved "${productName}" to ${path}`);

			return path;
		}
	}

	return null;
}

export function readProductPath(url)
{
	if (typeof url !== "string") return null;

	// A trailing slash is how MedBud writes these; tolerate its absence.
	const normalised = url.split(/[?#]/)[0].replace(/\/?$/, "/");

	return PRODUCT_URL_PATTERN.exec(normalised)?.[1]?.toLowerCase() ?? null;
}

export { MEDBUD_BASE_URL };
