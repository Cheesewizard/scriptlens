import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { productUrl, searchUrl, MEDBUD_BASE_URL } from "../src/shared/medbud-link.js";
import { findBestMatch, describeCandidate } from "../src/background/product-matcher.js";

const FORMULARY = JSON.parse(readFileSync(new URL("../src/data/medbud-index.json", import.meta.url), "utf8"));
const CANDIDATES = FORMULARY.map(describeCandidate);
const MINIMUM_SCORE = 0.45;

test("builds a product url from an index path", () =>
{
	assert.equal(productUrl("/strains/aurora-pedanios/pedanios-t29/"), "https://medbud.wiki/strains/aurora-pedanios/pedanios-t29/");
	assert.equal(MEDBUD_BASE_URL, "https://medbud.wiki");
});

test("builds a search restricted to MedBud", () =>
{
	const url = new URL(searchUrl("Aurora Pedanios SRD T29 Sourdough Flower 10g"));

	assert.equal(url.searchParams.get("q"), "Aurora Pedanios SRD T29 Sourdough Flower 10g site:medbud.wiki");
});

test("escapes characters that would break the query", () =>
{
	const url = new URL(searchUrl("SafriCanna CK T27 Creamy Kees #5 Flower 10g"));

	assert.equal(url.searchParams.get("q"), "SafriCanna CK T27 Creamy Kees #5 Flower 10g site:medbud.wiki");
});

test("rejects empty input rather than linking nowhere", () =>
{
	assert.throws(() => productUrl(""), /path is required/);
	assert.throws(() => searchUrl(""), /productName is required/);
});

// The bundled formulary is a snapshot and stock rotates, so the fallback is the
// common path, not an edge case. These are real current products that the
// matcher does not resolve — the point is that they still lead somewhere.
test("products absent from the bundled formulary still resolve to a search", () =>
{
	const unmatched = [
		"Aurora Pedanios SRD T29 Sourdough Flower 10g",
		"Dalgety MOG T24 Marshmallow OG Flower 10g",
		"Papers RS-ELV T24 RS-11 Flower 10g"
	];

	for (const name of unmatched)
	{
		assert.equal(findBestMatch(name, CANDIDATES, MINIMUM_SCORE), null, `${name} unexpectedly matched`);

		const url = new URL(searchUrl(name));
		assert.match(url.searchParams.get("q"), /site:medbud\.wiki$/);
	}
});

test("a product the formulary does list resolves to its page, not a search", () =>
{
	const match = findBestMatch("Hilltop Leaf XSM T30 XS Mintz Flower 10g", CANDIDATES, MINIMUM_SCORE);

	assert.ok(match, "expected a match for a product present in the formulary");
	assert.equal(productUrl(match.path), "https://medbud.wiki/strains/hilltop-leaf/xsm-t30-xs-mintz/");
});
