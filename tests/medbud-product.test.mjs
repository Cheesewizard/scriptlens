import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { readAggregateRating, readCategoryRatings } from "../src/background/medbud-product.js";

// Captured from the live LIT WF Smalls T30 White Fire page.
const PAGE = readFileSync(new URL("./fixtures/medbud-rating-fragment.html", import.meta.url), "utf8");

test("reads the schema.org aggregate rating", () =>
{
	assert.deepEqual(readAggregateRating(PAGE), { average: 3, bestRating: 5, ratingCount: 1, reviewCount: 1 });
});

test("reports an absent rating block as unrated rather than failing", () =>
{
	assert.deepEqual(readAggregateRating("<html><body>no reviews yet</body></html>"), { average: null, bestRating: 5, ratingCount: 0, reviewCount: 0 });
});

test("reads the per-category breakdown", () =>
{
	assert.deepEqual(readCategoryRatings(PAGE), [
		{ label: "Medicinal Effect", average: 4 },
		{ label: "Tastes & Terpenes", average: 2.5 },
		{ label: "Trim & Uniformity", average: 2 },
		{ label: "Freshness", average: 1 }
	]);
});
