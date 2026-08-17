import { test } from "node:test";
import assert from "node:assert/strict";

import { createBadge, applyRating, applyBlocked, applyError } from "../src/content/rating-badge.js";
import { parseFragment } from "./helpers/dom.mjs";

function badge()
{
	parseFragment("<div></div>");

	return createBadge();
}

test("starts in a loading state", () =>
{
	const element = badge();

	assert.equal(element.dataset.state, "loading");
	assert.equal(element.textContent, "MedBud…");
});

// The bundled formulary resolves the page but no rating is fetched, so the link
// is the payload.
test("a match with no rating fetched offers the page", () =>
{
	const element = badge();

	applyRating(element, { matched: true, ratingsFetched: false, url: "https://medbud.wiki/strains/hilltop-leaf/xsm-t30-xs-mintz/" });

	const link = element.querySelector("a");

	assert.equal(element.dataset.state, "linked");
	assert.equal(link.textContent, "View on MedBud");
	assert.equal(link.getAttribute("href"), "https://medbud.wiki/strains/hilltop-leaf/xsm-t30-xs-mintz/");
	assert.equal(link.getAttribute("target"), "_blank");
});

// Absent from a snapshot usually means renamed or listed since, so the badge
// offers a search rather than claiming MedBud has no entry.
test("an unmatched product offers a search", () =>
{
	const element = badge();

	applyRating(element, { matched: false, searchUrl: "https://www.google.com/search?q=x+site%3Amedbud.wiki" });

	const link = element.querySelector("a");

	assert.equal(element.dataset.state, "unmatched");
	assert.equal(link.textContent, "Find on MedBud");
	assert.match(link.getAttribute("href"), /site%3Amedbud\.wiki/);
});

test("a fetched rating still renders stars and the average", () =>
{
	const element = badge();

	applyRating(element, {
		matched: true,
		ratingsFetched: true,
		average: 4,
		bestRating: 5,
		ratingCount: 2,
		reviewCount: 1,
		url: "https://medbud.wiki/strains/aurora-pedanios/pedanios-t29/",
		categories: [{ label: "Medicinal Effect", average: 4 }]
	});

	assert.equal(element.dataset.state, "rated");
	assert.equal(element.dataset.tier, "high");
	assert.match(element.textContent, /4\.00 · 2 ratings/);
	assert.match(element.title, /Medicinal Effect: 4\.0/);
});

test("a fetched but unrated product says so", () =>
{
	const element = badge();

	applyRating(element, { matched: true, ratingsFetched: true, average: null, ratingCount: 0, url: "https://medbud.wiki/strains/x/y/" });

	assert.equal(element.dataset.state, "unrated");
	assert.equal(element.querySelector("a").textContent, "Not yet rated");
});

test("a challenge is reported as clearable, pointing at the blocked request", () =>
{
	const element = badge();

	applyBlocked(element, "MedBud is challenging automated requests.");

	assert.equal(element.dataset.state, "blocked");
	assert.equal(element.querySelector("a").getAttribute("href"), "https://medbud.wiki/strains/");
});

test("an unexpected failure keeps the reason on the badge", () =>
{
	const element = badge();

	applyError(element, new Error("boom"));

	assert.equal(element.dataset.state, "error");
	assert.equal(element.title, "boom");
});
