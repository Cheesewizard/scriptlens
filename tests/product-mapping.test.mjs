import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { lookUpMapping, readProducts } from "../src/background/product-mapping.js";

const SHIPPED = JSON.parse(readFileSync(new URL("../src/data/medbud-mapping.json", import.meta.url), "utf8"));
const AURORA = "Aurora Pedanios SRD T29 Sourdough Flower 10g";
const REMOTE_URL = "https://example.test/mapping.json";

function stubEnvironment({ remote = null, remoteStatus = 200 } = {})
{
	const store = new Map();
	const fetched = [];

	globalThis.chrome = {
		runtime: { getURL: (path) => `chrome-extension://test/${path}` },
		storage: {
			local: {
				get: async (key) => (store.has(key) ? { [key]: store.get(key) } : {}),
				set: async (entries) => { for (const [key, value] of Object.entries(entries)) store.set(key, value); },
				remove: async (keys) => { for (const key of [keys].flat()) store.delete(key); },
				getKeys: async () => [...store.keys()]
			}
		}
	};

	globalThis.fetch = async (url) =>
	{
		fetched.push(String(url));

		if (String(url).endsWith("medbud-mapping.json")) return new Response(JSON.stringify(SHIPPED), { status: 200 });
		if (remoteStatus !== 200) return new Response("nope", { status: remoteStatus });

		return new Response(JSON.stringify(remote), { status: 200 });
	};

	return fetched;
}

beforeEach(() =>
{
	stubEnvironment();
});

// The medication the matcher cannot reach: MedBud renamed it, and the slug holds
// neither the product code nor the strain name.
test("resolves a product the matcher cannot, from the shipped mapping", async () =>
{
	assert.equal(await lookUpMapping(AURORA, ""), "/strains/aurora-pedanios/pedanios-t29/");
});

test("returns nothing for a product it does not list", async () =>
{
	assert.equal(await lookUpMapping("Something Not Listed T20 Flower 10g", ""), null);
});

test("does not fetch a remote mapping when none is configured", async () =>
{
	const fetched = stubEnvironment();

	await lookUpMapping(AURORA, "");

	assert.ok(fetched.every((url) => url.endsWith("medbud-mapping.json")), "only the bundled mapping should be read");
});

test("a remote entry overrides the shipped one", async () =>
{
	stubEnvironment({ remote: { products: { [AURORA]: "/strains/aurora-pedanios/corrected-t29/" } } });

	assert.equal(await lookUpMapping(AURORA, REMOTE_URL), "/strains/aurora-pedanios/corrected-t29/");
});

test("a remote mapping adds to the shipped one rather than replacing it", async () =>
{
	stubEnvironment({ remote: { products: { "New Product T25 Flower 10g": "/strains/brand/new-product-t25/" } } });

	assert.equal(await lookUpMapping("New Product T25 Flower 10g", REMOTE_URL), "/strains/brand/new-product-t25/");
	assert.equal(await lookUpMapping(AURORA, REMOTE_URL), "/strains/aurora-pedanios/pedanios-t29/");
});

test("refreshes once a day rather than once a lookup", async () =>
{
	const fetched = stubEnvironment({ remote: { products: { "A T20 Flower 10g": "/strains/b/c/" } } });

	await lookUpMapping(AURORA, REMOTE_URL);
	await lookUpMapping(AURORA, REMOTE_URL);
	await lookUpMapping(AURORA, REMOTE_URL);

	assert.equal(fetched.filter((url) => url === REMOTE_URL).length, 1);
});

// The bundled mapping still works, so a failed refresh must not break lookups.
test("falls back to the shipped mapping when the remote is unreachable", async () =>
{
	stubEnvironment({ remoteStatus: 503 });

	assert.equal(await lookUpMapping(AURORA, REMOTE_URL), "/strains/aurora-pedanios/pedanios-t29/");
});

// A mapping is remote input, and a bad entry would put a card on the wrong
// medication.
test("discards entries that are not a medication path", () =>
{
	const products = readProducts({
		products: {
			"Good T20 Flower 10g": "/strains/brand/product/",
			"Brand page T20 Flower 10g": "/strains/brand/",
			"Absolute T20 Flower 10g": "https://medbud.wiki/strains/brand/product/",
			"Traversal T20 Flower 10g": "/strains/../../etc/passwd",
			"Wrong type T20 Flower 10g": 42
		}
	});

	assert.deepEqual(products, { "Good T20 Flower 10g": "/strains/brand/product/" });
});

test("rejects a mapping with nothing usable in it", () =>
{
	assert.equal(readProducts({ products: {} }), null);
	assert.equal(readProducts({ products: { "x": "/nope/" } }), null);
	assert.equal(readProducts({}), null);
	assert.equal(readProducts(null), null);
});

test("rejects an empty product name", async () =>
{
	await assert.rejects(() => lookUpMapping("", ""), /productName is required/);
});
