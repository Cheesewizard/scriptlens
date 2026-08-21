import { test } from "node:test";
import assert from "node:assert/strict";

import { findProductCards, findTitleElement, PRODUCT_ATTRIBUTE } from "../src/content/card-scanner.js";
import { loadFixture, parseFragment } from "./helpers/dom.mjs";

const GRID = "cb1-browse-grid.html";
const PAST_ORDER = "cb1-past-order-item.html";

// The four portal tabs, with the full product count on each - every card, not
// only the orderable ones. A product that is out of stock or over the patient's
// THC limit has no "Add to request" button but still shows an image and a title,
// and the scanner reads it from the image so its reviews are not lost. Keying off
// the add button once hid the majority of these: flower showed 40 of 128.
const EVERY_TAB = [
	{ tab: "flower", fixture: GRID, count: 128, overLimit: "Cookies MD T25 Medellin Flower 10g" },
	{ tab: "vapes", fixture: "cb1-vape-grid.html", count: 56, overLimit: null },
	{ tab: "oils", fixture: "cb1-oil-grid.html", count: 54, overLimit: "Curaleaf T100 Oil 30ml" },
	{ tab: "pastilles", fixture: "cb1-pastille-grid.html", count: 2, overLimit: null }
];

test("reads every product card on every tab", () =>
{
	for (const { tab, fixture, count } of EVERY_TAB)
	{
		const cards = findProductCards(loadFixture(fixture));

		assert.equal(cards.length, count, `wrong card count on the ${tab} tab`);

		for (const { card, productName } of cards)
		{
			assert.ok(findTitleElement(card, productName), `no title for ${productName} on the ${tab} tab`);
		}
	}
});

// The regression guard for the bug this scanner was rewritten to fix: a product
// with no "Add to request" button (over the THC limit, or out of stock) must
// still be found, because it still shows an image and its reviews still matter.
test("finds cards that have no add button", () =>
{
	for (const { tab, fixture, overLimit } of EVERY_TAB)
	{
		if (!overLimit) continue;

		const document = loadFixture(fixture);

		assert.equal(
			document.querySelector(`button[aria-label="Add ${overLimit} to request"]`),
			null,
			`${overLimit} was expected to have no add button`);

		const found = findProductCards(document).some((entry) => entry.productName === overLimit);
		assert.ok(found, `the scanner missed ${overLimit} on the ${tab} tab`);
	}
});

test("finds a medication on a past-order page with no product image", () =>
{
	const document = loadFixture(PAST_ORDER);
	const cards = findProductCards(document);

	assert.equal(document.querySelector("[aria-label$=' image']"), null);
	assert.equal(cards.length, 1);
	assert.equal(cards[0].productName, "LIT WF Smalls T30 White Fire Flower 10g");
	assert.equal(findTitleElement(cards[0].card, cards[0].productName)?.textContent.trim(), cards[0].productName);
});

test("skips a past-order item already decorated with the same medication", () =>
{
	const document = loadFixture(PAST_ORDER);
	const [item] = findProductCards(document);

	item.card.setAttribute(PRODUCT_ATTRIBUTE, item.productName);

	assert.deepEqual(findProductCards(document), []);
});

test("ignores a script control whose medication title is not in the same row", () =>
{
	const document = parseFragment(`
		<div>
			<div dir="auto">A Different Product T20 Flower 10g</div>
			<button aria-label="View script for Missing Product T20 Flower 10g">View script</button>
		</div>
	`);

	assert.deepEqual(findProductCards(document), []);
});

// The card is accepted only when it also holds the title bearing the same product
// name, so every result is self-validating on the image, whether or not it can be
// ordered.
test("every card holds the image it was found by", () =>
{
	for (const { card, productName } of findProductCards(loadFixture(GRID)))
	{
		assert.ok(
			[...card.querySelectorAll("[aria-label]")].some((element) =>
				element.getAttribute("aria-label") === `${productName} image`),
			`card for ${productName} lost its image`);
	}
});

// A leading digit, a colon in a ratio, and accented characters are all in the
// real grid; none may trip up the scan.
test("finds cards whose names carry awkward characters", () =>
{
	const byName = new Map(findProductCards(loadFixture(GRID)).map((entry) => [entry.productName, entry.card]));

	for (const name of [
		"4C Labs Core SCS T25 Scoops Flower 10g",
		"Therismos Access BLD T10:C10 Blue Dream Balanced Flower 10g",
		"Plantations Cérès RP T28 Rainbow Pavé Flower 10g"
	])
	{
		assert.ok(byName.get(name), `no card resolved for ${name}`);
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
	const before = findProductCards(document);
	const [first] = before;

	first.card.setAttribute(PRODUCT_ATTRIBUTE, first.productName);

	const names = findProductCards(document).map((entry) => entry.productName);

	assert.equal(names.length, before.length - 1);
	assert.ok(!names.includes(first.productName));
});

// The grid recycles DOM nodes across filter and tab changes, so a decorated card
// can come back holding a different product and must be picked up again.
test("re-reports a recycled card now holding a different product", () =>
{
	const document = loadFixture(GRID);
	const before = findProductCards(document);
	const [first] = before;

	first.card.setAttribute(PRODUCT_ATTRIBUTE, "Some Other Product T20 Flower 10g");

	const names = findProductCards(document).map((entry) => entry.productName);

	assert.equal(names.length, before.length);
	assert.ok(names.includes(first.productName));
});

test("ignores an image whose label has no matching title", () =>
{
	const document = parseFragment(`
		<div>
			<img aria-label="Some Decorative Banner image">
			<div dir="auto">An unrelated product</div>
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
