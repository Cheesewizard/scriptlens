import { findProductCards, findTitleElement, PRODUCT_ATTRIBUTE } from "./card-scanner.js";
import { createBadge, applyRating, applyError, applyBlocked, appendStrainLink, BADGE_CLASS } from "./rating-badge.js";
import { CHALLENGED_CODE, MESSAGE_TYPES } from "../shared/messages.js";
import { extractStrain, isFlower } from "../shared/strain.js";
import { leaflyStrainUrl } from "../shared/leafly-link.js";
import { loadSettings } from "../shared/settings.js";
import { warn } from "../shared/logging.js";

const RESCAN_DEBOUNCE_MS = 250;

let settings = await loadSettings();
let rescanTimer = null;

scan();
observeGrid();
watchSettings();

function observeGrid()
{
	const observer = new MutationObserver(() =>
	{
		clearTimeout(rescanTimer);
		rescanTimer = setTimeout(scan, RESCAN_DEBOUNCE_MS);
	});

	observer.observe(document.body, { childList: true, subtree: true });
}

function watchSettings()
{
	chrome.storage.sync.onChanged.addListener(async () => { settings = await loadSettings(); });
}

function scan()
{
	for (const { card, productName } of findProductCards(document))
	{
		card.setAttribute(PRODUCT_ATTRIBUTE, productName);
		decorate(card, productName);
	}
}

async function decorate(card, productName)
{
	// A recycled card can still carry the previous product's badge.
	card.querySelector(`.${BADGE_CLASS}`)?.remove();

	const title = findTitleElement(card, productName);

	if (!title)
	{
		warn(`no title element found for "${productName}"`, card);
		return;
	}

	const badge = createBadge();
	title.parentElement.insertBefore(badge, title);

	try
	{
		const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REQUEST_RATING, productName });

		// Being challenged is not a lookup failure: it is a thing the user can
		// clear, and every card on the page will report it at once.
		if (response?.code === CHALLENGED_CODE)
		{
			applyBlocked(badge, response.reason);
			return;
		}

		if (!response?.ok) throw new Error(response?.reason ?? "background lookup failed");

		// The card may have been recycled into a different product while the
		// lookup was in flight, in which case this result is no longer hers.
		if (card.getAttribute(PRODUCT_ATTRIBUTE) !== productName)
		{
			badge.remove();
			return;
		}

		if (!response.result.matched && !settings.showUnmatchedProducts)
		{
			badge.remove();
			return;
		}

		renderBadge(badge, response.result, productName);

		// A product the formulary cannot place gets its real page looked up, but
		// only once you hover it. Resolving all forty on page load would spend a
		// search quota on cards you never look at.
		if (!response.result.matched) resolveOnInterest(card, badge, productName);
	}
	catch (reason)
	{
		applyError(badge, reason);
	}
}

// The MedBud state plus, for flower, a link to the strain's Leafly profile.
// Both the first render and the hover upgrade go through here, since applyRating
// rebuilds the badge and would otherwise drop the Leafly link.
function renderBadge(badge, result, productName)
{
	applyRating(badge, result);

	if (!isFlower(productName)) return;

	const strain = extractStrain(productName);
	if (strain) appendStrainLink(badge, leaflyStrainUrl(strain));
}

// Hovering a card resolves its exact MedBud page in the background and swaps the
// badge's search link for the direct one — so by the time it is clicked it points
// straight at the medication. Until then the badge already links to a search that
// finds it, so nothing is lost if the lookup has not finished.
function resolveOnInterest(card, badge, productName)
{
	let started = false;

	const start = () =>
	{
		if (started) return;

		started = true;
		lookUpLink(card, badge, productName);
	};

	card.addEventListener("pointerenter", start);

	// Touch and keyboard never fire pointerenter, so a tap still triggers it.
	card.addEventListener("pointerdown", start);
}

async function lookUpLink(card, badge, productName)
{
	try
	{
		const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RESOLVE_LINK, productName });

		if (!response?.ok) throw new Error(response?.reason ?? "link lookup failed");
		if (!response.result.url) return;

		// The card may have been recycled while the lookup was in flight.
		if (card.getAttribute(PRODUCT_ATTRIBUTE) !== productName) return;

		if (badge.isConnected) renderBadge(badge, { matched: true, ratingsFetched: false, url: response.result.url }, productName);
	}
	catch (reason)
	{
		warn(`could not resolve a MedBud link for "${productName}"`, reason);
	}
}
