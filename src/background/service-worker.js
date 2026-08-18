import { clearCache } from "./http-cache.js";
import { loadIndex, INDEX_TTL_MS } from "./medbud-index.js";
import { resolveProductLink } from "./link-resolver.js";
import { requestRating } from "./rating-service.js";
import { productUrl } from "../shared/medbud-link.js";
import { MESSAGE_TYPES } from "../shared/messages.js";
import { loadSettings } from "../shared/settings.js";
import { setDebugLogging, error } from "../shared/logging.js";

// The toolbar icon has no popup; clicking it opens the settings page.
chrome.action?.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((message, sender, sendResponse) =>
{
	handleMessage(message)
		.then(result => sendResponse({ ok: true, result }))
		.catch(reason =>
		{
			error(reason);

			// The code travels separately because an Error does not survive the
			// structured clone across the message channel.
			sendResponse({ ok: false, reason: reason?.message ?? String(reason), code: reason?.code ?? null });
		});

	// Keeps the message channel open for the asynchronous response above.
	return true;
});

async function handleMessage(message)
{
	const settings = await loadSettings();
	setDebugLogging(settings.debugLogging);

	switch (message?.type)
	{
		case MESSAGE_TYPES.REQUEST_RATING:
			return requestRating(message.productName);

		case MESSAGE_TYPES.RESOLVE_LINK:
			return describeResolvedLink(await resolveProductLink(message.productName, settings.searchApiKey));

		case MESSAGE_TYPES.REFRESH_INDEX:
			return describeIndex(await loadIndex({ forceRefresh: true, live: true }));

		case MESSAGE_TYPES.CLEAR_CACHE:
			return { removedEntries: await clearCache() };

		case MESSAGE_TYPES.GET_STATUS:
			return { ...describeIndex(await loadIndex({ live: settings.liveRatings })), settings };

		default:
			throw new Error(`Unknown message type: ${message?.type}`);
	}
}

function describeResolvedLink(resolved)
{
	return { url: resolved.path === null ? null : productUrl(resolved.path), reason: resolved.reason };
}

function describeIndex(index)
{
	return {
		indexedProducts: index.paths.length,
		fetchedAt: index.fetchedAt,
		expiresAt: index.fetchedAt + INDEX_TTL_MS,
		bundled: index.bundled === true
	};
}
