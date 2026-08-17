import { test } from "node:test";
import assert from "node:assert/strict";

import { findBestMatch, tokenise } from "../src/background/product-matcher.js";

const MINIMUM_SCORE = 0.45;

const INDEX = [
	"/strains/lit/wf-t30-white-fire/",
	"/strains/lit/sl-t30-snow-lotus/",
	"/strains/lit/sd-t30-sour-diesel/",
	"/strains/muzo/gp-t31-gastro-pop/",
	"/strains/kanha/neoi-t27-neon-icon/",
	"/strains/safricanna/ck-t27-creamy-kees-5/",
	"/strains/safricanna/ck-t22-creamy-kees-5/",
	"/strains/4c-labs/core-cck-t26-cold-creek-kush/",
	"/strains/ips/las-t26-l-a-s-a-g-e/",
	"/strains/all-nations/tt-m-t25-tropic-thunder/",
	"/strains/common-roots/wz-t25-watermelon-zkittlez/",
	"/strains/4c-labs/pnw-t7-c7-pennywise/"
];

test("strips weights and product-form noise from a portal title", () =>
{
	assert.deepEqual(tokenise("LIT WF Smalls T30 White Fire Flower 10g"), ["lit", "wf", "t30", "white", "fire"]);
});

test("matches every card from the browse grid to its MedBud page", () =>
{
	const expected = new Map([
		["Muzo GP T31 Gastro Pop Flower 10g", "/strains/muzo/gp-t31-gastro-pop/"],
		["LIT WF Smalls T30 White Fire Flower 10g", "/strains/lit/wf-t30-white-fire/"],
		["Kanha NEOI T27 Neon Icon Flower 10g", "/strains/kanha/neoi-t27-neon-icon/"],
		["SafriCanna CK T27 Creamy Kees #5 Flower 10g", "/strains/safricanna/ck-t27-creamy-kees-5/"],
		["4C Labs Core CCK T26 Cold Creek Kush Flower 10g", "/strains/4c-labs/core-cck-t26-cold-creek-kush/"],
		["IPS LAS T26 L.A. S.A.G.E. Flower 10g", "/strains/ips/las-t26-l-a-s-a-g-e/"],
		["All Nations TT-M T25 Tropic Thunder Smalls Flower 10g", "/strains/all-nations/tt-m-t25-tropic-thunder/"],
		["Common Roots WZ T25 Watermelon Zkittlez Flower 10g", "/strains/common-roots/wz-t25-watermelon-zkittlez/"]
	]);

	for (const [title, path] of expected)
	{
		const match = findBestMatch(title, INDEX, MINIMUM_SCORE);

		assert.ok(match, `expected a match for ${title}`);
		assert.equal(match.path, path);
	}
});

test("separates products that differ only by potency", () =>
{
	const match = findBestMatch("SafriCanna CK T22 Creamy Kees #5 Flower 10g", INDEX, MINIMUM_SCORE);

	assert.equal(match.path, "/strains/safricanna/ck-t22-creamy-kees-5/");
});

test("matches balanced THC:CBD products", () =>
{
	const match = findBestMatch("4C Labs PNW T7:C7 Pennywise Flower 10g", INDEX, MINIMUM_SCORE);

	assert.equal(match.path, "/strains/4c-labs/pnw-t7-c7-pennywise/");
});

test("returns null rather than guessing at an unknown medication", () =>
{
	assert.equal(findBestMatch("Fictional FIC T99 Nonexistent Flower 10g", INDEX, MINIMUM_SCORE), null);
});

test("rejects a same-brand same-potency product with a different strain", () =>
{
	const match = findBestMatch("LIT SL Smalls T30 Snow Lotus Flower 10g", INDEX, MINIMUM_SCORE);

	assert.equal(match.path, "/strains/lit/sl-t30-snow-lotus/");
});
