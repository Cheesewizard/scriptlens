import { findProductCards, findTitleElement, PRODUCT_ATTRIBUTE } from "./card-scanner.js";
import { createBadge, applyRating, applyError, applyBlocked, appendStrainLink, BADGE_CLASS } from "./rating-badge.js";
import { linkTitle, unlinkTitles, TITLE_LINK_CLASS } from "./title-link.js";
import { CHALLENGED_CODE, MESSAGE_TYPES } from "../shared/messages.js";
import { extractStrain, isFlower } from "../shared/strain.js";
import { leaflyStrainUrl } from "../shared/leafly-link.js";
import { loadSettings } from "../shared/settings.js";
import { warn } from "../shared/logging.js";

const RESCAN_DEBOUNCE_MS = 250;

// How long a click will wait for an in-flight lookup before giving up and using
// the search link. Long enough for a search API round trip, short enough not to
// feel like a hang.
const RESOLVE_CLICK_GRACE_MS = 800;

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

		// The name always leads somewhere: the matched page when there is one,
		// otherwise a search, which is how a renamed or newly listed medication
		// gets found.
		const destination = response.result.url ?? response.result.searchUrl;
		if (destination) linkTitle(title, destination);

		if (!response.result.matched && !settings.showUnmatchedProducts)
		{
			badge.remove();
			return;
		}

		renderBadge(badge, response.result, productName);

		// A product the formulary cannot place gets its real page looked up, but
		// only once you show interest in it. Resolving all forty on page load
		// would spend a search quota on cards you never look at.
		if (!response.result.matched) resolveOnInterest(card, title, badge, productName);
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

// Hovering starts the lookup; by the time a click lands it is usually already
// done and the link simply works. When it is not, the click opens the tab
// immediately — inside the gesture, so the popup blocker allows it — and points
// it at the medication as soon as the lookup returns.
function resolveOnInterest(card, title, badge, productName)
{
	let pending = null;
	let resolvedUrl = null;

	const start = () =>
	{
		if (pending === null) pending = lookUpLink(card, title, badge, productName).then((url) => (resolvedUrl = url));

		return pending;
	};

	card.addEventListener("pointerenter", start);

	// Touch and keyboard never fire pointerenter, so the click still has to work.
	card.addEventListener("pointerdown", start);

	card.addEventListener("click", (event) =>
	{
		const link = event.target.closest?.(`.${TITLE_LINK_CLASS}`);
		if (!link || resolvedUrl !== null) return;

		const lookup = start();
		const fallback = link.href;

		event.preventDefault();
		event.stopPropagation();

		const opened = window.open("", "_blank", "noopener");

		Promise.race([lookup, waitFor(RESOLVE_CLICK_GRACE_MS)])
			.then((url) => { if (opened) opened.location = url ?? fallback; })
			.catch(() => { if (opened) opened.location = fallback; });
	}, true);
}

async function lookUpLink(card, title, badge, productName)
{
	try
	{
		const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RESOLVE_LINK, productName });

		if (!response?.ok) throw new Error(response?.reason ?? "link lookup failed");
		if (!response.result.url) return null;

		// The card may have been recycled while the lookup was in flight.
		if (card.getAttribute(PRODUCT_ATTRIBUTE) !== productName) return null;

		linkTitle(title, response.result.url);
		if (badge.isConnected) renderBadge(badge, { matched: true, ratingsFetched: false, url: response.result.url }, productName);

		return response.result.url;
	}
	catch (reason)
	{
		warn(`could not resolve a MedBud link for "${productName}"`, reason);

		return null;
	}
}

function waitFor(milliseconds)
{
	return new Promise((resolve) => setTimeout(() => resolve(null), milliseconds));
}
