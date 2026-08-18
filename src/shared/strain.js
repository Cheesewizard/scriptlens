// A CB1 flower name is <brand> <code> <potency> <strain> <form>, e.g.
// "LIT WF Smalls T30 White Fire Flower 10g". Leafly is organised by strain, not
// by product, so the strain is the part worth pulling out: the words after the
// potency, with the form, weight and batch markers removed.
//
// This feeds a search rather than a direct URL, because Leafly's own naming does
// not follow from a CB1 name — its "White Fire" lives at /strains/white-fire-og
// — so the extraction only has to be good enough for a search to land, not exact.

const POTENCY_PATTERN = /^[tc]\d{1,3}(:[tc]?\d{1,3})?$/i;
const WEIGHT_PATTERN = /^\d+(\.\d+)?(g|ml|mg)$/i;
const BATCH_PATTERN = /^#\d+$/;

// Words that describe the product form or pack, not the strain.
const FORM_WORDS = new Set(["flower", "smalls", "minis", "mini", "medical", "cannabis", "the"]);

export function extractStrain(productName)
{
	if (typeof productName !== "string") return null;

	const words = productName.trim().split(/\s+/);

	// The potency (T30, T10:C10) sits between the brand/code and the strain, so
	// the strain is whatever follows the last potency-looking token.
	let potencyIndex = -1;
	for (let index = 0; index < words.length; index += 1)
	{
		if (POTENCY_PATTERN.test(words[index])) potencyIndex = index;
	}

	if (potencyIndex === -1) return null;

	const strain = words
		.slice(potencyIndex + 1)
		.filter((word) => !FORM_WORDS.has(word.toLowerCase()) && !WEIGHT_PATTERN.test(word) && !BATCH_PATTERN.test(word))
		.join(" ")
		.trim();

	return strain.length > 0 ? strain : null;
}

// Terpene and effect profiles are a flower property. Vapes and oils carry a
// strain too, but the profile is what a flower buyer reaches for, and it is the
// scope this was asked for.
export function isFlower(productName)
{
	return typeof productName === "string" && /\bflower\b/i.test(productName);
}
