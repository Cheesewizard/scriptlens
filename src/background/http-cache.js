const CACHE_PREFIX = "cache:";

export async function readCached(key)
{
	if (!key) throw new Error("key is required");

	const storageKey = CACHE_PREFIX + key;
	const stored = await chrome.storage.local.get(storageKey);
	const entry = stored[storageKey];

	if (!entry) return null;

	if (entry.expiresAt <= Date.now())
	{
		await chrome.storage.local.remove(storageKey);
		return null;
	}

	return entry.value;
}

export async function writeCached(key, value, ttlMilliseconds)
{
	if (!key) throw new Error("key is required");
	if (!(ttlMilliseconds > 0)) throw new Error("ttlMilliseconds must be a positive number");

	await chrome.storage.local.set({
		[CACHE_PREFIX + key]: { value, expiresAt: Date.now() + ttlMilliseconds }
	});
}

export async function clearCache()
{
	const everything = await chrome.storage.local.get(null);
	const keys = Object.keys(everything).filter(key => key.startsWith(CACHE_PREFIX));

	if (keys.length === 0) return 0;

	await chrome.storage.local.remove(keys);

	return keys.length;
}
