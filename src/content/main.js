import { findProductCards, findTitleElement, PRODUCT_ATTRIBUTE } from "./card-scanner.js";
import { createBadge, applyRating, applyError, appendStrainLink, BADGE_CLASS } from "./rating-badge.js";
import { MESSAGE_TYPES } from "../shared/messages.js";
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
	}
	catch (reason)
	{
		applyError(badge, reason);
	}
}

// The MedBud state plus, for flower, a link to the strain's Leafly profile.
function renderBadge(badge, result, productName)
{
	applyRating(badge, result);

	if (!isFlower(productName)) return;

	const strain = extractStrain(productName);
	if (strain) appendStrainLink(badge, leaflyStrainUrl(strain));
}
