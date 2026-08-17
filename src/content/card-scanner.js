const ADD_BUTTON_PATTERN = /\badd to (cart|order|request|basket)\b/i;
const POTENCY_PATTERN = /\bT\d{1,3}\b/;
const PRICE_PATTERN = /£\s?\d/;
const MAX_ANCESTOR_WALK = 8;

export const PROCESSED_ATTRIBUTE = "data-medbud-processed";

export function findUnprocessedCards(root)
{
	if (!root) throw new Error("root is required");

	const cards = new Set();

	for (const control of root.querySelectorAll("button, a, [role='button']"))
	{
		if (!ADD_BUTTON_PATTERN.test(control.textContent ?? "")) continue;

		const card = findCardAncestor(control);
		if (card && !card.hasAttribute(PROCESSED_ATTRIBUTE)) cards.add(card);
	}

	return [...cards];
}

// The portal ships hashed class names, so a card is identified by shape instead:
// the nearest ancestor of an add-to-cart control that also holds a potency code
// and a price is the product tile.
function findCardAncestor(control)
{
	let element = control.parentElement;

	for (let depth = 0; element && depth < MAX_ANCESTOR_WALK; depth += 1)
	{
		const text = element.textContent ?? "";

		if (POTENCY_PATTERN.test(text) && PRICE_PATTERN.test(text)) return element;

		element = element.parentElement;
	}

	return null;
}

export function findTitleElement(card)
{
	if (!card) throw new Error("card is required");

	let best = null;

	for (const element of card.querySelectorAll("*"))
	{
		const text = (element.textContent ?? "").trim();

		if (text.length === 0) continue;
		if (!POTENCY_PATTERN.test(text)) continue;
		if (text.includes("£") || text.includes("%")) continue;
		if (ADD_BUTTON_PATTERN.test(text)) continue;

		// The shortest qualifying text belongs to the deepest element, which is
		// the title node rather than one of its wrappers.
		if (best === null || text.length < best.text.length) best = { element, text };
	}

	return best;
}
