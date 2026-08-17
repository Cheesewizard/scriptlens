import { findUnprocessedCards, findTitleElement, PROCESSED_ATTRIBUTE } from "./card-scanner.js";
import { createBadge, applyRating, applyError } from "./rating-badge.js";
import { MESSAGE_TYPES } from "../shared/messages.js";
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
	for (const card of findUnprocessedCards(document))
	{
		card.setAttribute(PROCESSED_ATTRIBUTE, "true");
		decorate(card);
	}
}

async function decorate(card)
{
	const title = findTitleElement(card);

	if (!title)
	{
		warn("no medication title found inside product card", card);
		return;
	}

	const badge = createBadge();
	title.element.parentElement.insertBefore(badge, title.element);

	try
	{
		const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REQUEST_RATING, title: title.text });
		if (!response?.ok) throw new Error(response?.reason ?? "background lookup failed");

		if (!response.result.matched && !settings.showUnmatchedProducts)
		{
			badge.remove();
			return;
		}

		applyRating(badge, response.result);
	}
	catch (reason)
	{
		applyError(badge, reason);
	}
}
