// Leafly is where the terpene and effect profile lives, keyed by strain. Its own
// naming does not follow from a CB1 name — "White Fire" is /strains/white-fire-og
// there — and there is no bundled Leafly index to match against, so a guessed
// slug would 404 more often than not. A search scoped to Leafly's strain pages
// lands on the right one instead, the same honest fallback the MedBud side uses
// for a product it cannot place directly.
export function leaflyStrainUrl(strain)
{
	if (!strain) throw new Error("strain is required");

	const query = encodeURIComponent(`${strain} strain site:leafly.com/strains`);

	return `https://www.google.com/search?q=${query}`;
}
