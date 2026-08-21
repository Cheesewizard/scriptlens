// The portal is React Native Web, so class names are hashed atomic utilities and
// useless as selectors. Browse cards and past-order rows do carry accessibility
// labels that give the exact product name without broad text scraping:
//   <div aria-label="LIT WF Smalls T30 White Fire Flower 10g image">
//   <div dir="auto">LIT WF Smalls T30 White Fire Flower 10g</div>
//   <button aria-label="View script for LIT WF Smalls T30 White Fire Flower 10g">
//
// Browse cards are keyed off the product image, not the "Add to request" button:
// a product that is out of stock or over the patient's THC limit has no add
// button but still shows an image. Past-order rows have no product image, so
// their "View script" control is the equivalent stable anchor.
const IMAGE_LABEL_SUFFIX = " image";
const IMAGE_SELECTOR = "[aria-label$=' image']";
const ORDER_SCRIPT_LABEL_PREFIX = "View script for ";
const ORDER_SCRIPT_SELECTOR = "button[aria-label^='View script for ']";
const MAX_ANCESTOR_WALK = 6;

export const PRODUCT_ATTRIBUTE = "data-medbud-product";

export function findProductCards(root)
{
	if (!root) throw new Error("root is required");

	const cards = [];
	const seenCards = new Set();

	appendProductCards(
		root.querySelectorAll(IMAGE_SELECTOR),
		getImageProductName,
		cards,
		seenCards);
	appendProductCards(
		root.querySelectorAll(ORDER_SCRIPT_SELECTOR),
		getOrderProductName,
		cards,
		seenCards);

	return cards;
}

function appendProductCards(anchors, getProductName, cards, seenCards)
{
	for (const anchor of anchors)
	{
		const productName = getProductName(anchor);
		if (!productName) continue;

		const card = findCardAncestor(anchor, productName);
		if (!card || seenCards.has(card)) continue;

		// The grid recycles DOM nodes when filters or tabs change, so a card that
		// was already decorated can come back holding a different product. The
		// recorded name is what tells the two cases apart.
		if (card.getAttribute(PRODUCT_ATTRIBUTE) === productName) continue;

		seenCards.add(card);
		cards.push({ card, productName });
	}
}

function getImageProductName(image)
{
	const label = image.getAttribute("aria-label");
	if (!label?.endsWith(IMAGE_LABEL_SUFFIX)) return null;

	return label.slice(0, -IMAGE_LABEL_SUFFIX.length).trim() || null;
}

function getOrderProductName(scriptButton)
{
	const label = scriptButton.getAttribute("aria-label");
	if (!label?.startsWith(ORDER_SCRIPT_LABEL_PREFIX)) return null;

	return label.slice(ORDER_SCRIPT_LABEL_PREFIX.length).trim() || null;
}

// The card root is the nearest ancestor of the accessibility anchor that also
// holds the product's title. Matching both copies of the exact name validates
// the pairing and filters out unrelated images and controls.
function findCardAncestor(anchor, productName)
{
	let element = anchor.parentElement;

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
