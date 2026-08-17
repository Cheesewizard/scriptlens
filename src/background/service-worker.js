import { clearCache } from "./http-cache.js";
import { loadProductIndex } from "./medbud-index.js";
import { requestRating } from "./rating-service.js";
import { MESSAGE_TYPES } from "../shared/messages.js";
import { loadSettings } from "../shared/settings.js";
import { setDebugLogging, error } from "../shared/logging.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) =>
{
	handleMessage(message)
		.then(result => sendResponse({ ok: true, result }))
		.catch(reason =>
		{
			error(reason);
			sendResponse({ ok: false, reason: reason?.message ?? String(reason) });
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
			return requestRating(message.title);

		case MESSAGE_TYPES.CLEAR_CACHE:
			return { removedEntries: await clearCache() };

		case MESSAGE_TYPES.GET_STATUS:
			return { indexedProducts: (await loadProductIndex()).length, settings };

		default:
			throw new Error(`Unknown message type: ${message?.type}`);
	}
}
