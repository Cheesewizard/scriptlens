import { describeCandidate } from "./product-matcher.js";
import { debug } from "../shared/logging.js";

const BUNDLED_INDEX_PATH = "src/data/medbud-index.json";

// The tokenised form of the formulary is held for the life of the service worker
// rather than rebuilt on every lookup.
let describedCache = null;
let bundledCache = null;

// The formulary ships with the extension, so matching costs no network at all -
// nothing is ever fetched from MedBud. The list is a snapshot; refreshing it
// means shipping a new version of the extension.
export async function loadIndex()
{
	if (bundledCache) return bundledCache;

	const response = await fetch(chrome.runtime.getURL(BUNDLED_INDEX_PATH));
	if (!response.ok) throw new Error(`bundled MedBud formulary could not be read (status ${response.status})`);

	bundledCache = { paths: await response.json() };

	debug(`loaded ${bundledCache.paths.length} medications from the bundled formulary`);

	return bundledCache;
}

export async function loadCandidates()
{
	const index = await loadIndex();

	if (!describedCache) describedCache = index.paths.map(describeCandidate);

	return { candidates: describedCache };
}
