import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { findBestMatch, describeCandidate, readProductCode, tokenise } from "../src/background/product-matcher.js";

const MINIMUM_SCORE = 0.45;

// The real MedBud formulary and the real set of product names from a browse page,
// captured from both live sites. The formulary is read from the copy the
// extension actually ships, so these tests police the shipped data rather than a
// fixture that could drift away from it.
const CANDIDATES = readShipped("medbud-index.json").map(describeCandidate);
const PRODUCT_NAMES = readFixture("cb1-product-names.json");

// Every product on the captured browse page that is present in the captured index.
// The remainder are absent from that index snapshot, and asserted separately.
const EXPECTED_MATCHES = new Map([
	["Muzo GP T31 Gastro Pop Flower 10g", "/strains/muzo/gp-t31-gastro-pop/"],
	["LIT WF Smalls T30 White Fire Flower 10g", "/strains/lit/wf-t30-white-fire/"],
	["Kanha NEOI T27 Neon Icon Flower 10g", "/strains/kanha/neoi-t27-neon-icon/"],
	["SafriCanna CK T27 Creamy Kees #5 Flower 10g", "/strains/safricanna/ck-t27-creamy-kees/"],
	["4C Labs Core CCK T26 Cold Creek Kush Flower 10g", "/strains/4c-labs/cck-t26-cold-creek-kush/"],
	["IPS LAS T26 L.A. S.A.G.E. Flower 10g", "/strains/ips/las-t26-la-sage/"],
	["All Nations TT-M T25 Tropic Thunder Smalls Flower 10g", "/strains/all-nations/tt-m-smalls-t25-tropic-thunder/"],
	["Common Roots WZ T25 Watermelon Zkittlez Flower 10g", "/strains/common-roots/wz-t25-watermelon-zkittlez/"],
	["4C Labs Core SCS T25 Scoops Flower 10g", "/strains/4c-labs/core-scs-t25-scoops/"],
	["Wellford Luma MAC T25 Miracle Alien Cookies #3 Flower 10g", "/strains/wellford/t25-mac/"],
	["4C Labs Value XK-S Smalls T24 Oaxacan Kush Flower 10g", "/strains/4c-labs/value-xk-smalls-t24-oaxacan-kush/"],
	["Phant PM Smalls T24 Pineapple Marker Flower 10g", "/strains/phant/pm-minis-t24-pineapple-marker/"],
	["Curaleaf WPT T24 Wedding Pop Triangle Flower 10g", "/strains/curaleaf/wpt-t24-wedding-pop-triangle/"],
	["All Nations MDO-M T23 MAC Doughnut Smalls Flower 10g", "/strains/all-nations/mdo-m-smalls-t23-mac-doughnut/"],
	["Curaleaf GZZ T23 GMO ZKZ Flower 10g", "/strains/curaleaf/gzz-t23/"],
	["4C Labs Core PGL T22 Platinum Garlic Flower 10g", "/strains/4c-labs/pgl-t22-platinum-garlic/"],
	["Curaleaf LCE T20 Lavender Cake Flower 10g", "/strains/curaleaf/t20-lavender-cake/"],
	["Curaleaf TPI T20 Tripoli Flower 10g", "/strains/curaleaf/t20-tripoli/"],

	// MedBud lists this medication only at T27. CB1 labels the batch it is
	// selling, so the potencies differ while the brand, product code and strain
	// all agree — the same medication, resolved by the potency-tolerant pass.
	["4C Labs Core ACB T21 Acai Berry Flower 10g", "/strains/4c-labs/acb-t27-acai-berry/"]
]);

// Listed on CB1 but missing from this index snapshot. A miss is the correct
// answer; a match would mean the matcher had invented one.
const EXPECTED_MISSES = [
	"All Nations MD T22 MAC Daddy Flower 10g",
	"4C Labs Value SCK-S Smalls T22 Strawberry Cake Flower 10g",
	"Curaleaf RMY T20 Royal Moby Flower 10g",
	"Tastee Bitz PS T18 Banjo Medical Cannabis Flower 10g"
];

test("strips weights and product-form noise from a portal title", () =>
{
	assert.deepEqual(tokenise("LIT WF Smalls T30 White Fire Flower 10g"), ["lit", "wf", "t30", "white", "fire"]);
});

test("reads the product code that precedes the potency", () =>
{
	assert.equal(readProductCode(tokenise("LIT WF Smalls T30 White Fire")), "wf");
	assert.equal(readProductCode(tokenise("All Nations TT-M T25 Tropic Thunder")), "ttm");
	assert.equal(readProductCode(tokenise("4C Labs Value SCK-S Smalls T22 Strawberry Cake")), "scks");
	assert.equal(readProductCode(tokenise("t20-lavender-cake")), null);
});

test("resolves every browse-page product that MedBud has indexed", () =>
{
	for (const [productName, path] of EXPECTED_MATCHES)
	{
		const match = findBestMatch(productName, CANDIDATES, MINIMUM_SCORE);

		assert.ok(match, `expected a match for ${productName}`);
		assert.equal(match.path, path, `wrong match for ${productName}`);
	}
});

test("returns nothing rather than guessing when MedBud has not listed the product", () =>
{
	for (const productName of EXPECTED_MISSES)
	{
		assert.equal(findBestMatch(productName, CANDIDATES, MINIMUM_SCORE), null, `invented a match for ${productName}`);
	}
});

test("covers every product on the captured browse page", () =>
{
	assert.equal(EXPECTED_MATCHES.size + EXPECTED_MISSES.length, PRODUCT_NAMES.length);
});

test("separates products differing only by potency", () =>
{
	const match = findBestMatch("SafriCanna CK T22 Creamy Kees #5 Flower 10g", CANDIDATES, MINIMUM_SCORE);

	assert.notEqual(match?.path, "/strains/safricanna/ck-t27-creamy-kees/");
});

// The potency-tolerant pass exists for batch labelling and nothing else. Both of
// these were live wrong matches produced by a looser first attempt at it.
test("does not cross brands to forgive a potency difference", () =>
{
	const match = findBestMatch("Papers RS-ELV T24 RS-11 Flower 10g", CANDIDATES, MINIMUM_SCORE);

	assert.notEqual(match?.path, "/strains/doja/rs-11/", "matched another brand's medication");
});

test("does not forgive a potency difference on a partial strain name", () =>
{
	const match = findBestMatch("All Nations MD T22 MAC Daddy Flower 10g", CANDIDATES, MINIMUM_SCORE);

	assert.notEqual(match?.path, "/strains/all-nations/t27-mac-doughnut/", "MAC Daddy is not MAC Doughnut");
});

test("prefers the exact potency when MedBud lists both", () =>
{
	const match = findBestMatch("SafriCanna CK T22 Creamy Kees #5 Flower 10g", CANDIDATES, MINIMUM_SCORE);

	assert.equal(match.path, "/strains/safricanna/ck-t22-creamy-kees-5/");
});

test("separates products differing only by product code", () =>
{
	const match = findBestMatch("4C Labs Core HCB T21 Huckleberry Flower 10g", CANDIDATES, MINIMUM_SCORE);

	assert.equal(match.path, "/strains/4c-labs/core-hcb-t21-huckleberry/");
});

test("ignores slugs too generic to identify a product", () =>
{
	const generic = [describeCandidate("/strains/all-nations/t28/")];

	assert.equal(findBestMatch("All Nations XX T28 Something Flower 10g", generic, MINIMUM_SCORE), null);
});

function readFixture(name)
{
	return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

// Read from what the extension ships, not a copy of it.
function readShipped(name)
{
	return JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), "utf8"));
}
