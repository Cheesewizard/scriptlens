export const MEDBUD_BASE_URL = "https://medbud.wiki";

// MedBud files medications under one of these sections, always as
// /section/brand/product/. A mapping entry or a search result must match this,
// or it is not a medication page - a brand landing page, a forum thread or a
// review - and must not be linked to as one.
export const MEDBUD_PATH_PATTERN = /^\/(?:strains|vape-cartridges|oils|edibles|extracts)\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\/$/;

export function productUrl(path)
{
	if (!path) throw new Error("path is required");

	return MEDBUD_BASE_URL + path;
}

// Where a product has no entry in the shipped formulary, a search still lands on
// the right page. That matters more than it sounds: the formulary is a snapshot,
// stock rotates constantly, and MedBud renames medications - CB1's "Aurora
// Pedanios SRD T29 Sourdough" is MedBud's "Aurora SRD-CA T29 Sourdough" at
// /strains/aurora-pedanios/pedanios-t29/, a slug carrying neither the product
// code nor the strain name. No token matcher resolves that; a search does, which
// is how people find these pages by hand.
export function searchUrl(productName)
{
	if (!productName) throw new Error("productName is required");

	const query = encodeURIComponent(`${productName} site:medbud.wiki`);

	return `https://www.google.com/search?q=${query}`;
}
