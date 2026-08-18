import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { extractStrain, isFlower } from "../src/shared/strain.js";
import { leaflyStrainUrl } from "../src/shared/leafly-link.js";

test("takes the strain from between the potency and the form", () =>
{
	assert.equal(extractStrain("LIT WF Smalls T30 White Fire Flower 10g"), "White Fire");
	assert.equal(extractStrain("Muzo GP T31 Gastro Pop Flower 10g"), "Gastro Pop");
	assert.equal(extractStrain("4C Labs Core CCK T26 Cold Creek Kush Flower 10g"), "Cold Creek Kush");
});

test("drops the pack and batch words", () =>
{
	assert.equal(extractStrain("All Nations TT-M T25 Tropic Thunder Smalls Flower 10g"), "Tropic Thunder");
	assert.equal(extractStrain("Wellford Luma MAC T25 Miracle Alien Cookies #3 Flower 10g"), "Miracle Alien Cookies");
	assert.equal(extractStrain("SafriCanna CK T27 Creamy Kees #5 Flower 10g"), "Creamy Kees");
});

test("handles a ratio potency and keeps accents", () =>
{
	assert.equal(extractStrain("Therismos Access BLD T10:C10 Blue Dream Balanced Flower 10g"), "Blue Dream Balanced");
	assert.equal(extractStrain("Plantations Cérès RP T28 Rainbow Pavé Flower 10g"), "Rainbow Pavé");
});

test("returns nothing when there is no potency to anchor on", () =>
{
	assert.equal(extractStrain("Some Accessory Grinder"), null);
	assert.equal(extractStrain(""), null);
	assert.equal(extractStrain(null), null);
});

test("recognises flower, and only flower", () =>
{
	assert.equal(isFlower("LIT WF Smalls T30 White Fire Flower 10g"), true);
	assert.equal(isFlower("Curaleaf QUE JHR T420 Jack Herer Cart 0.5g"), false);
	assert.equal(isFlower("Curaleaf Oil T10:C10 Peppermint 30ml"), false);
});

// Every flower name in the real grid must yield a usable strain, or the Leafly
// link silently goes missing on that card.
test("yields a strain for every flower product in the real grid", () =>
{
	const html = readFileSync(new URL("./fixtures/cb1-browse-grid.html", import.meta.url), "utf8");
	const names = [...new Set([...html.matchAll(/aria-label="Add (.*?) to request"/g)].map((m) => m[1]))];

	for (const name of names.filter(isFlower))
	{
		const strain = extractStrain(name);

		assert.ok(strain && strain.length > 1, `no strain extracted from ${name}`);
	}
});

test("builds a Leafly search scoped to strain pages", () =>
{
	const url = new URL(leaflyStrainUrl("White Fire"));

	assert.equal(url.searchParams.get("q"), "White Fire strain site:leafly.com/strains");
});

test("rejects an empty strain", () =>
{
	assert.throws(() => leaflyStrainUrl(""), /strain is required/);
});
