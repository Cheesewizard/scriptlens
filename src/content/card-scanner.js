// The portal is React Native Web, so class names are hashed atomic utilities and
// useless as selectors. Every card does carry accessibility labels, which are
// stable and give the exact product name without any text scraping:
//   <div aria-label="LIT WF Smalls T30 White Fire Flower 10g image">
//   <div dir="auto">LIT WF Smalls T30 White Fire Flower 10g</div>
//
// Cards are keyed off the product image, not the "Add to request" button: a
// product that is out of stock or over the patient's THC limit has no add
// button but still shows an image, and its reviews are worth just as much. Keying
// off the button silently hid every such product — the majority of some tabs.
const IMAGE_LABEL_SUFFIX = " image";
const IMAGE_SELECTOR = "[aria-label$=' image']";
const MAX_ANCESTOR_WALK = 6;

export const PRODUCT_ATTRIBUTE = "data-medbud-product";

export function findProductCards(root)
{
	if (!root) throw new Error("root is required");

	const cards = [];
	const seen = new Set();

	for (const image of root.querySelectorAll(IMAGE_SELECTOR))
	{
		const label = image.getAttribute("aria-label");
		if (!label?.endsWith(IMAGE_LABEL_SUFFIX)) continue;

		const productName = label.slice(0, -IMAGE_LABEL_SUFFIX.length);
		if (!productName || seen.has(productName)) continue;

		const card = findCardAncestor(image, productName);
		if (!card) continue;

		// The grid recycles DOM nodes when filters or tabs change, so a card that
		// was already decorated can come back holding a different product. The
		// recorded name is what tells the two cases apart.
		if (card.getAttribute(PRODUCT_ATTRIBUTE) === productName) continue;

		seen.add(productName);
		cards.push({ card, productName });
	}

	return cards;
}

// The card root is the nearest ancestor of the image that also holds the
// product's title, which self-validates the pairing via the same product name
// and filters out any stray image whose label happens to end in "image".
function findCardAncestor(image, productName)
{
	let element = image.parentElement;

	for (let depth = 0; element && depth < MAX_ANCESTOR_WALK; depth += 1)
	{
		if (findTitleElement(element, productName)) return element;

		element = element.parentElement;
	}

	return null;
}

export function findTitleElement(card, productName)
{
	if (!card) throw new Error("card is required");
	if (!productName) throw new Error("productName is required");

	for (const element of card.querySelectorAll("div[dir='auto']"))
	{
		if (element.textContent.trim() === productName) return element;
	}

	return null;
}
