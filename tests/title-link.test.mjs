import { test } from "node:test";
import assert from "node:assert/strict";

import { findProductCards, findTitleElement } from "../src/content/card-scanner.js";
import { linkTitle, unlinkTitles, TITLE_LINK_CLASS } from "../src/content/title-link.js";
import { loadFixture } from "./helpers/dom.mjs";

const GRID = "cb1-browse-grid.html";
const MEDBUD_URL = "https://medbud.wiki/strains/lit/white-fire/";

function firstCard()
{
	const document = loadFixture(GRID);
	const [entry] = findProductCards(document);

	return { document, ...entry, title: findTitleElement(entry.card, entry.productName) };
}

test("wraps the title in a link to the MedBud page", () =>
{
	const { title, productName } = firstCard();
	const originalParent = title.parentElement;

	const link = linkTitle(title, MEDBUD_URL);

	assert.equal(link.tagName.toLowerCase(), "a");
	assert.equal(link.getAttribute("href"), MEDBUD_URL);
	assert.equal(link.getAttribute("target"), "_blank");
	assert.equal(link.getAttribute("rel"), "noopener noreferrer");

	// The title keeps its own node and text; only its parent changed.
	assert.equal(title.parentElement, link);
	assert.equal(link.parentElement, originalParent);
	assert.equal(title.textContent.trim(), productName);
});

test("leaves the portal's own title markup untouched", () =>
{
	const { title } = firstCard();
	const before = title.outerHTML;

	linkTitle(title, MEDBUD_URL);

	assert.equal(title.outerHTML, before);
});

test("updates the href instead of nesting a second link", () =>
{
	const { card, title } = firstCard();

	linkTitle(title, MEDBUD_URL);
	const second = linkTitle(title, "https://medbud.wiki/strains/muzo/gastro-pop/");

	assert.equal(card.querySelectorAll(`.${TITLE_LINK_CLASS}`).length, 1);
	assert.equal(second.getAttribute("href"), "https://medbud.wiki/strains/muzo/gastro-pop/");
	assert.equal(title.parentElement, second);
});

// A recycled card must not keep pointing at the product it used to show.
test("unwrapping restores the title to its original parent", () =>
{
	const { card, title } = firstCard();
	const originalParent = title.parentElement;

	linkTitle(title, MEDBUD_URL);
	unlinkTitles(card);

	assert.equal(card.querySelectorAll(`.${TITLE_LINK_CLASS}`).length, 0);
	assert.equal(title.parentElement, originalParent);
});

test("unwrapping a card that was never linked does nothing", () =>
{
	const { card, title } = firstCard();
	const originalParent = title.parentElement;

	unlinkTitles(card);

	assert.equal(title.parentElement, originalParent);
});

test("rejects a link with no title or url", () =>
{
	const { title } = firstCard();

	assert.throws(() => linkTitle(null, MEDBUD_URL), /title is required/);
	assert.throws(() => linkTitle(title, ""), /url is required/);
	assert.throws(() => unlinkTitles(null), /card is required/);
});
