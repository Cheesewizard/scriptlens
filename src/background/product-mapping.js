import { readCached, writeCached } from "./http-cache.js";
import { MEDBUD_PATH_PATTERN } from "../shared/medbud-link.js";
import { debug, warn } from "../shared/logging.js";

const BUNDLED_MAPPING_PATH = "src/data/medbud-mapping.json";
const MAPPING_CACHE_KEY = "medbud-mapping";

// The catalogue is the same for every patient, so a medication resolved once is
// resolved for everybody. Refreshing daily is ample: CB1 lists new products
// steadily but not hourly, and a miss still falls through to the matcher and the
// search, so a stale mapping costs a little precision rather than a broken card.
const MAPPING_TTL_MS = 24 * 60 * 60 * 1000;

// A mapping that answered nothing is more likely a broken deploy than a real
// empty catalogue, so it is refused rather than allowed to blank the bundled one.
const MINIMUM_USEFUL_ENTRIES = 1;

let bundledCache = null;

// Resolution order is cheapest-first: the shared mapping, then the local
// matcher, then a search. This is the tier that scales - it costs one small
// request a day however many products are on screen.
export async function lookUpMapping(productName, mappingUrl)
{
	if (!productName) throw new Error("productName is required");

	const products = await loadProducts(mappingUrl);

	return products[productName] ?? null;
}

async function loadProducts(mappingUrl)
{
	const bundled = await loadBundled();

	if (!mappingUrl) return bundled;

	const remote = await loadRemote(mappingUrl);

	// Remote wins per key, so a correction ships without a new extension version,
	// but anything the remote omits still resolves from the bundled copy.
	return remote === null ? bundled : { ...bundled, ...remote };
}

async function loadBundled()
{
	if (bundledCache) return bundledCache;

	const response = await fetch(chrome.runtime.getURL(BUNDLED_MAPPING_PATH));
	if (!response.ok) throw new Error(`bundled mapping could not be read (status ${response.status})`);

	bundledCache = readProducts(await response.json()) ?? {};

	return bundledCache;
}

async function loadRemote(mappingUrl)
{
	const cached = await readCached(MAPPING_CACHE_KEY);
	if (cached) return cached.products;

	try
	{
		const response = await fetch(mappingUrl, { cache: "no-cache" });
		if (!response.ok) throw new Error(`status ${response.status}`);

		const products = readProducts(await response.json());
		if (products === null) throw new Error("no usable product entries");

		await writeCached(MAPPING_CACHE_KEY, { products }, MAPPING_TTL_MS);
		debug(`refreshed the shared mapping: ${Object.keys(products).length} medications`);

		return products;
	}
	catch (reason)
	{
		// The bundled mapping still works, so a fetch failure is not fatal. Retried
		// on the next lookup rather than cached, since the cause is usually
		// transient.
		warn(`could not refresh the shared MedBud mapping from ${mappingUrl}`, reason);

		return null;
	}
}

// Only well-formed medication paths are accepted. A mapping is remote input, and
// a bad entry would put a card on the wrong medication.
export function readProducts(document)
{
	const products = document?.products;
	if (products === null || typeof products !== "object") return null;

	const usable = {};

	for (const [name, path] of Object.entries(products))
	{
		if (typeof name !== "string" || name.length === 0) continue;
		if (typeof path !== "string") continue;
		if (!MEDBUD_PATH_PATTERN.test(path)) continue;

		usable[name] = path;
	}

	return Object.keys(usable).length >= MINIMUM_USEFUL_ENTRIES ? usable : null;
}
