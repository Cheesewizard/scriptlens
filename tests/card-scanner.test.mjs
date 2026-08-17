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
	"Muzo GP T31 Gastro Pop Flower 10g",
	"LIT WF Smalls T30 White Fire Flower 10g",
	"Kanha NEOI T27 Neon Icon Flower 10g",
	"SafriCanna CK T27 Creamy Kees #5 Flower 10g",
	"4C Labs Core CCK T26 Cold Creek Kush Flower 10g",
	"IPS LAS T26 L.A. S.A.G.E. Flower 10g",
	"All Nations TT-M T25 Tropic Thunder Smalls Flower 10g",
	"Common Roots WZ T25 Watermelon Zkittlez Flower 10g",
	"4C Labs Core SCS T25 Scoops Flower 10g",
	"Wellford Luma MAC T25 Miracle Alien Cookies #3 Flower 10g",
	"4C Labs Value XK-S Smalls T24 Oaxacan Kush Flower 10g",
	"Phant PM Smalls T24 Pineapple Marker Flower 10g",
	"Curaleaf WPT T24 Wedding Pop Triangle Flower 10g",
	"All Nations MDO-M T23 MAC Doughnut Smalls Flower 10g",
	"Curaleaf GZZ T23 GMO ZKZ Flower 10g",
	"All Nations MD T22 MAC Daddy Flower 10g",
	"4C Labs Core PGL T22 Platinum Garlic Flower 10g",
	"4C Labs Value SCK-S Smalls T22 Strawberry Cake Flower 10g",
	"4C Labs Core ACB T21 Acai Berry Flower 10g",
	"Curaleaf LCE T20 Lavender Cake Flower 10g",
	"Curaleaf TPI T20 Tripoli Flower 10g",
	"Curaleaf RMY T20 Royal Moby Flower 10g",
	"Tastee Bitz PS T18 Banjo Medical Cannabis Flower 10g"
];

test("finds every product card in a real browse grid", () =>
{
	const cards = findProductCards(loadFixture(GRID));

	assert.equal(cards.length, EXPECTED_NAMES.length);
	assert.deepEqual(cards.map((entry) => entry.productName), EXPECTED_NAMES);
});

// Names carrying '#', '.' or a leading digit are the ones that break a naive
// selector build, and all three appear in the real grid.
test("finds cards whose names need escaping in a selector", () =>
{
	const cards = findProductCards(loadFixture(GRID));
	const byName = new Map(cards.map((entry) => [entry.productName, entry.card]));

	for (const name of [
		"SafriCanna CK T27 Creamy Kees #5 Flower 10g",
		"IPS LAS T26 L.A. S.A.G.E. Flower 10g",
		"4C Labs Core ACB T21 Acai Berry Flower 10g"
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
