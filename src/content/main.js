import { findProductCards, findTitleElement, PRODUCT_ATTRIBUTE } from "./card-scanner.js";
import { createBadge, applyRating, applyError, applyBlocked, BADGE_CLASS } from "./rating-badge.js";
import { linkTitle, unlinkTitles } from "./title-link.js";
import { CHALLENGED_CODE, MESSAGE_TYPES } from "../shared/messages.js";
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
	// A recycled card can still carry the previous product's badge and title
	// link. Both go first: the link wraps the title, so it has to be undone
	// before the title's parent is used as the badge's anchor point.
	card.querySelector(`.${BADGE_CLASS}`)?.remove();
	unlinkTitles(card);

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

		applyRating(badge, response.result);

		// Only a matched product has a page to point at.
		if (response.result.matched && response.result.url) linkTitle(title, response.result.url);
	}
	catch (reason)
	{
		applyError(badge, reason);
	}
}
