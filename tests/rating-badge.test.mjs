import { test } from "node:test";
import assert from "node:assert/strict";

import { createBadge, applyRating, appendStrainLink, applyError, STRAIN_LINK_CLASS } from "../src/content/rating-badge.js";
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

test("a matched product links to its MedBud page", () =>
{
	const element = badge();

	applyRating(element, { matched: true, url: "https://medbud.wiki/strains/hilltop-leaf/xsm-t30-xs-mintz/" });

	const link = element.querySelector("a");

	assert.equal(element.dataset.state, "linked");
	assert.equal(link.textContent, "View on MedBud");
	assert.equal(link.getAttribute("href"), "https://medbud.wiki/strains/hilltop-leaf/xsm-t30-xs-mintz/");
	assert.equal(link.getAttribute("target"), "_blank");
});

// A search fallback is indistinguishable from a direct link: same label, same
// look. The search is the rare case, and the badge does not advertise it.
test("an unmatched product still reads as a link to MedBud", () =>
{
	const element = badge();

	applyRating(element, { matched: false, searchUrl: "https://www.google.com/search?q=x+site%3Amedbud.wiki" });

	const link = element.querySelector("a");

	assert.equal(element.dataset.state, "linked");
	assert.equal(link.textContent, "View on MedBud");
	assert.match(link.getAttribute("href"), /site%3Amedbud\.wiki/);
});

test("a matched and an unmatched product are visually identical", () =>
{
	const matched = badge();
	applyRating(matched, { matched: true, url: "https://medbud.wiki/strains/a/b/" });

	const unmatched = badge();
	applyRating(unmatched, { matched: false, searchUrl: "https://www.google.com/search?q=x" });

	assert.equal(matched.dataset.state, unmatched.dataset.state);
	assert.equal(matched.querySelector("a").textContent, unmatched.querySelector("a").textContent);
});

test("appends a Leafly link after the MedBud one", () =>
{
	const element = badge();

	applyRating(element, { matched: true, url: "https://medbud.wiki/strains/a/b/" });
	appendStrainLink(element, "https://www.google.com/search?q=White+Fire+site%3Aleafly.com");

	const leafly = element.querySelector(`.${STRAIN_LINK_CLASS}`);

	assert.equal(leafly.textContent, "Leafly");
	assert.match(leafly.getAttribute("href"), /leafly\.com/);
});

test("does not append a second Leafly link", () =>
{
	const element = badge();

	applyRating(element, { matched: true, url: "https://medbud.wiki/strains/a/b/" });
	appendStrainLink(element, "https://www.google.com/search?q=x");
	appendStrainLink(element, "https://www.google.com/search?q=x");

	assert.equal(element.querySelectorAll(`.${STRAIN_LINK_CLASS}`).length, 1);
});

test("an unexpected failure keeps the reason on the badge", () =>
{
	const element = badge();

	applyError(element, new Error("boom"));

	assert.equal(element.dataset.state, "error");
	assert.equal(element.title, "boom");
});

test("rejects a missing badge or result", () =>
{
	assert.throws(() => applyRating(null, {}), /badge is required/);
	assert.throws(() => applyRating(badge(), null), /result is required/);
});
