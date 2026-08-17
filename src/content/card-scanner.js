// The portal is React Native Web, so class names are hashed atomic utilities and
// useless as selectors. Every card does carry accessibility labels, which are
// stable and give the exact product name without any text scraping:
//   <div aria-label="LIT WF Smalls T30 White Fire Flower 10g image">
//   <button aria-label="Add LIT WF Smalls T30 White Fire Flower 10g to request">
const ADD_BUTTON_SELECTOR = "button[aria-label^='Add '][aria-label$=' to request']";
const ADD_LABEL_PATTERN = /^Add (.+) to request$/;
const MAX_ANCESTOR_WALK = 6;

export const PRODUCT_ATTRIBUTE = "data-medbud-product";

export function findProductCards(root)
{
	if (!root) throw new Error("root is required");

	const cards = [];

	for (const button of root.querySelectorAll(ADD_BUTTON_SELECTOR))
	{
		const productName = ADD_LABEL_PATTERN.exec(button.getAttribute("aria-label"))?.[1];
		if (!productName) continue;

		const card = findCardAncestor(button, productName);
		if (!card) continue;

		// The grid recycles DOM nodes when filters or tabs change, so a card that
		// was already decorated can come back holding a different product. The
		// recorded name is what tells the two cases apart.
		if (card.getAttribute(PRODUCT_ATTRIBUTE) === productName) continue;

		cards.push({ card, productName });
	}

	return cards;
}

// The card root is the nearest ancestor of the button that also holds the
// product image, which self-validates the match via the same product name.
function findCardAncestor(button, productName)
{
	const imageSelector = `[aria-label="${CSS.escape(productName)} image"]`;
	let element = button.parentElement;

	for (let depth = 0; element && depth < MAX_ANCESTOR_WALK; depth += 1)
	{
		if (element.querySelector(imageSelector)) return element;

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
