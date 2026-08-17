import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { resolveProductLink, readProductPath } from "../src/background/link-resolver.js";

const PRODUCT = "Aurora Pedanios SRD T29 Sourdough Flower 10g";
const KEY = "test-key";

// The service worker's cache sits on chrome.storage.local.
function stubStorage()
{
	const store = new Map();

	globalThis.chrome = {
		storage: {
			local: {
				get: async (key) => (store.has(key) ? { [key]: store.get(key) } : {}),
				set: async (entries) => { for (const [key, value] of Object.entries(entries)) store.set(key, value); },
				remove: async (keys) => { for (const key of [keys].flat()) store.delete(key); },
				getKeys: async () => [...store.keys()]
			}
		}
	};

	return store;
}

function stubSearch(results, { status = 200 } = {})
{
	const calls = [];

	globalThis.fetch = async (url, options) =>
	{
		calls.push({ url, options });

		if (status !== 200) return new Response("{}", { status });

		return new Response(JSON.stringify({ web: { results } }), { status: 200, headers: { "content-type": "application/json" } });
	};

	return calls;
}

beforeEach(() =>
{
	stubStorage();
});

test("reads a medication path out of a result url", () =>
{
	assert.equal(readProductPath("https://medbud.wiki/strains/aurora-pedanios/pedanios-t29/"), "/strains/aurora-pedanios/pedanios-t29/");
	assert.equal(readProductPath("https://medbud.wiki/strains/aurora-pedanios/pedanios-t29"), "/strains/aurora-pedanios/pedanios-t29/");
	assert.equal(readProductPath("https://medbud.wiki/strains/aurora-pedanios/pedanios-t29/?utm=x"), "/strains/aurora-pedanios/pedanios-t29/");
});

// A brand landing page, an article or another site is not what a card links to.
test("rejects urls that are not a medication page", () =>
{
	assert.equal(readProductPath("https://medbud.wiki/strains/aurora-pedanios/"), null);
	assert.equal(readProductPath("https://medbud.wiki/forums/thread/123/"), null);
	assert.equal(readProductPath("https://example.com/strains/a/b/"), null);
	assert.equal(readProductPath(undefined), null);
});

test("resolves a product to its medication page", async () =>
{
	const calls = stubSearch([
		{ url: "https://www.reddit.com/r/ukmedicalcannabis/comments/x/" },
		{ url: "https://medbud.wiki/strains/aurora-pedanios/pedanios-t29/" }
	]);

	assert.deepEqual(await resolveProductLink(PRODUCT, KEY), { path: "/strains/aurora-pedanios/pedanios-t29/", reason: null });

	// The search engine is asked, never MedBud.
	assert.equal(calls.length, 1);
	assert.match(calls[0].url, /^https:\/\/api\.search\.brave\.com\//);
	assert.equal(calls[0].options.headers["X-Subscription-Token"], KEY);
	assert.match(decodeURIComponent(calls[0].url), /site:medbud\.wiki/);
});

test("caches a resolved link rather than searching again", async () =>
{
	const calls = stubSearch([{ url: "https://medbud.wiki/strains/aurora-pedanios/pedanios-t29/" }]);

	await resolveProductLink(PRODUCT, KEY);
	await resolveProductLink(PRODUCT, KEY);

	assert.equal(calls.length, 1, "a cached link should not spend another search");
});

test("shares one search between cards showing the same product", async () =>
{
	const calls = stubSearch([{ url: "https://medbud.wiki/strains/aurora-pedanios/pedanios-t29/" }]);

	const [first, second] = await Promise.all([resolveProductLink(PRODUCT, KEY), resolveProductLink(PRODUCT, KEY)]);

	assert.equal(calls.length, 1);
	assert.deepEqual(first, second);
});

test("reports no result rather than linking to something else", async () =>
{
	stubSearch([{ url: "https://www.leafly.com/strains/sourdough" }]);

	assert.deepEqual(await resolveProductLink(PRODUCT, KEY), { path: null, reason: "not-found" });
});

test("does not search at all without a key", async () =>
{
	const calls = stubSearch([{ url: "https://medbud.wiki/strains/aurora-pedanios/pedanios-t29/" }]);

	assert.deepEqual(await resolveProductLink(PRODUCT, ""), { path: null, reason: "no-api-key" });
	assert.equal(calls.length, 0);
});

test("explains a rejected key instead of failing silently", async () =>
{
	stubSearch([], { status: 401 });

	await assert.rejects(() => resolveProductLink(PRODUCT, "wrong"), /rejected the key/);
});

test("explains a rate limit", async () =>
{
	stubSearch([], { status: 429 });

	await assert.rejects(() => resolveProductLink(PRODUCT, KEY), /rate limit/);
});

test("rejects an empty product name", async () =>
{
	assert.throws(() => resolveProductLink("", KEY), /productName is required/);
});
