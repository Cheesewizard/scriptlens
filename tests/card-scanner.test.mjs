import { test } from "node:test";
import assert from "node:assert/strict";

import { findProductCards, findTitleElement, PRODUCT_ATTRIBUTE } from "../src/content/card-scanner.js";
import { loadFixture, parseFragment } from "./helpers/dom.mjs";

// The real card grid, lifted out of a saved browse page by
// tools/make-card-fixture.mjs. Class names in it are hashed atomic utilities,
// which is exactly why the scanner keys off accessibility labels instead.
const GRID = "cb1-browse-grid.html";

// Document order, which is the order the badges get applied in.
const EXPECTED_NAMES = [
	"Hilltop Leaf XSM T30 XS Mintz Flower 10g",
	"Aurora Pedanios SRD T29 Sourdough Flower 10g",
	"Dalgety MOG T24 Marshmallow OG Flower 10g",
	"Tastee Bitz PS T18 Banjo Medical Cannabis Flower 10g",
	"All Nations MDO-M T23 MAC Doughnut Smalls Flower 10g",
	"All Nations TT-M T25 Tropic Thunder Smalls Flower 10g",
	"All Nations MD T22 MAC Daddy Flower 10g",
	"Papers RS-ELV T24 RS-11 Flower 10g",
	"Common Roots WZ T25 Watermelon Zkittlez Flower 10g",
	"4C Labs Value XK-S Smalls T24 Oaxacan Kush Flower 10g",
	"Green Gold SP T23 Starburst Pebbles Flower 10g",
	"Plantations Cérès RP T28 Rainbow Pavé Flower 10g",
	"Plantations Cérès SB T19 Superboof Flower 10g",
	"CannFX PM T25 Permanent Marker Flower 10g",
	"4C Labs Core SCS T25 Scoops Flower 10g",
	"4C Labs Core PGD T27 Pineapple God Flower 10g",
	"Greyscales JFRO T23 Jack Frosted Flower 10g",
	"4C Labs Value KCO T28 Kush Cookies Flower 10g",
	"4C Labs Core PKS T29 Pink Kush Flower 10g",
	"4C Labs Core PGL T22 Platinum Garlic Flower 10g",
	"Seed Junky PM T25 Permanent Marker Flower 10g",
	"Hilltop Leaf HTL BT T30 Banoffee Tart Flower 10g",
	"Greyscales PLG T22 Platinum Gushers Flower 10g",
	"HighGreens AA T27 Atomic Apple Flower 10g",
	"Sitka WHG T20 White Hot Guava Flower 10g",
	"4C Labs Core DGZ T28 Dawgzilla Flower 10g",
	"Hilltop Leaf HTL GM T27 Grape Muffin Flower 10g",
	"Phant GTH T22 Ghost Train Haze Flower 10g",
	"4C Labs Core SCO T26 Sun County Kush Flower 10g",
	"Common Roots MW T25 Maui Wowie Flower 10g",
	"4C Labs Craft CTR T25 Citroli Flower 10g",
	"FTP FP T21 Frosted Pave Flower 10g",
	"HighGreens LDS T27 Lemon Diesel Fritter Flower 10g",
	"Cérès CJ T27 Cap Junky Flower 10g",
	"4C Labs Core CCK T26 Cold Creek Kush Flower 10g",
	"Roxton Air FP T26 Flurry Pancakes Flower 10g",
	"Green Karat SL T28 Super Lemon Skunk Flower 10g",
	"Superseed GRP CKS T27 Grape Cookies Flower 10g",
	"Therismos Access BLD T10:C10 Blue Dream Balanced Flower 10g",
	"4C Labs GGU T25 Grandi Guava Flower 10g"
];

test("finds every product card in a real browse grid", () =>
{
	const cards = findProductCards(loadFixture(GRID));

	assert.equal(cards.length, EXPECTED_NAMES.length);
	assert.deepEqual(cards.map((entry) => entry.productName), EXPECTED_NAMES);
});

// A leading digit becomes a hex escape, a colon becomes a backslash escape, and
// accented characters must be left alone — all three are in the real grid, and
// all three break a selector built by plain interpolation.
test("finds cards whose names need escaping in a selector", () =>
{
	const cards = findProductCards(loadFixture(GRID));
	const byName = new Map(cards.map((entry) => [entry.productName, entry.card]));

	for (const name of [
		"4C Labs Core SCS T25 Scoops Flower 10g",
		"Therismos Access BLD T10:C10 Blue Dream Balanced Flower 10g",
		"Plantations Cérès RP T28 Rainbow Pavé Flower 10g"
	])
	{
		assert.ok(byName.get(name), `no card resolved for ${name}`);
	}
});

// The card is only accepted when it also holds the image bearing the same
// product name, so every result is self-validating.
test("returns a card that contains both the button and the matching image", () =>
{
	for (const { card, productName } of findProductCards(loadFixture(GRID)))
	{
		assert.ok(
			card.querySelector(`button[aria-label="Add ${productName} to request"]`),
			`card for ${productName} lost its add button`);

		assert.ok(
			[...card.querySelectorAll("[aria-label]")].some((element) =>
				element.getAttribute("aria-label") === `${productName} image`),
			`card for ${productName} lost its image`);
	}
});

test("finds the title element for every card", () =>
{
	for (const { card, productName } of findProductCards(loadFixture(GRID)))
	{
		const title = findTitleElement(card, productName);

		assert.ok(title, `no title element for ${productName}`);
		assert.equal(title.textContent.trim(), productName);
		assert.equal(title.tagName.toLowerCase(), "div");
		assert.equal(title.getAttribute("dir"), "auto");
	}
});

test("skips a card already decorated with the same product", () =>
{
	const document = loadFixture(GRID);
	const [first] = findProductCards(document);

	first.card.setAttribute(PRODUCT_ATTRIBUTE, first.productName);

	const names = findProductCards(document).map((entry) => entry.productName);

	assert.equal(names.length, EXPECTED_NAMES.length - 1);
	assert.ok(!names.includes(first.productName));
});

// The grid recycles DOM nodes across filter and tab changes, so a decorated
// card can come back holding a different product and must be picked up again.
test("re-reports a recycled card now holding a different product", () =>
{
	const document = loadFixture(GRID);
	const [first] = findProductCards(document);

	first.card.setAttribute(PRODUCT_ATTRIBUTE, "Some Other Product T20 Flower 10g");

	const names = findProductCards(document).map((entry) => entry.productName);

	assert.equal(names.length, EXPECTED_NAMES.length);
	assert.ok(names.includes(first.productName));
});

test("ignores an add button with no matching product image", () =>
{
	const document = parseFragment(`
		<div>
			<div><button aria-label="Add Ghost GH T20 Ghost Flower 10g to request">Add to Cart</button></div>
		</div>
	`);

	assert.deepEqual(findProductCards(document), []);
});

test("returns nothing for a page with no cards", () =>
{
	assert.deepEqual(findProductCards(parseFragment("<div><p>No medication found.</p></div>")), []);
});

test("reports a missing title rather than guessing", () =>
{
	const document = parseFragment(`<div id="card"><div dir="auto">A Different Product</div></div>`);

	assert.equal(findTitleElement(document.getElementById("card"), "Muzo GP T31 Gastro Pop Flower 10g"), null);
});

test("rejects calls with no root or card", () =>
{
	assert.throws(() => findProductCards(null), /root is required/);
	assert.throws(() => findTitleElement(null, "x"), /card is required/);
	assert.throws(() => findTitleElement(parseFragment("<div></div>").body, ""), /productName is required/);
});
