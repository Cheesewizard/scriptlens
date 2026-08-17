import { MESSAGE_TYPES } from "../shared/messages.js";
import { loadSettings, saveSettings } from "../shared/settings.js";

const FEEDBACK_TIMEOUT_MS = 2500;

const minimumMatchScoreInput = document.getElementById("minimumMatchScore");
const minimumMatchScoreValue = document.getElementById("minimumMatchScoreValue");
const showUnmatchedProductsInput = document.getElementById("showUnmatchedProducts");
const debugLoggingInput = document.getElementById("debugLogging");
const refreshIndexButton = document.getElementById("refreshIndex");
const clearCacheButton = document.getElementById("clearCache");
const statusText = document.getElementById("status");
const feedbackText = document.getElementById("feedback");

let feedbackTimer = null;

await initialise();

async function initialise()
{
	const settings = await loadSettings();

	minimumMatchScoreInput.value = String(settings.minimumMatchScore);
	showUnmatchedProductsInput.checked = settings.showUnmatchedProducts;
	debugLoggingInput.checked = settings.debugLogging;
	renderMatchScore();

	minimumMatchScoreInput.addEventListener("input", renderMatchScore);
	minimumMatchScoreInput.addEventListener("change", persist);
	showUnmatchedProductsInput.addEventListener("change", persist);
	debugLoggingInput.addEventListener("change", persist);
	refreshIndexButton.addEventListener("click", handleRefreshIndex);
	clearCacheButton.addEventListener("click", handleClearCache);

	await renderStatus(MESSAGE_TYPES.GET_STATUS);
}

function renderMatchScore()
{
	minimumMatchScoreValue.textContent = `${Math.round(Number(minimumMatchScoreInput.value) * 100)}%`;
}

async function persist()
{
	await saveSettings({
		minimumMatchScore: Number(minimumMatchScoreInput.value),
		showUnmatchedProducts: showUnmatchedProductsInput.checked,
		debugLogging: debugLoggingInput.checked
	});

	showFeedback("Saved.");
}

async function handleRefreshIndex()
{
	refreshIndexButton.disabled = true;
	statusText.textContent = "Refreshing…";

	await renderStatus(MESSAGE_TYPES.REFRESH_INDEX);

	refreshIndexButton.disabled = false;
	showFeedback("Index refreshed.");
}

async function handleClearCache()
{
	const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CLEAR_CACHE });

	if (!response?.ok)
	{
		showFeedback(`Could not clear the cache: ${response.reason}`);
		return;
	}

	showFeedback(`Cleared ${response.result.removedEntries} cached entries.`);
	await renderStatus(MESSAGE_TYPES.GET_STATUS);
}

async function renderStatus(messageType)
{
	const response = await chrome.runtime.sendMessage({ type: messageType });

	if (!response?.ok)
	{
		statusText.textContent = `MedBud index unavailable: ${response.reason}`;
		return;
	}

	const { indexedProducts, fetchedAt, expiresAt } = response.result;

	statusText.textContent = `${indexedProducts} medications indexed ${describeAge(fetchedAt)}. Refreshes automatically ${describeDue(expiresAt)}.`;
}

function describeAge(timestamp)
{
	const minutes = Math.round((Date.now() - timestamp) / 60000);

	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

	const hours = Math.round(minutes / 60);

	return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

function describeDue(timestamp)
{
	const minutes = Math.round((timestamp - Date.now()) / 60000);

	if (minutes <= 0) return "on the next lookup";
	if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;

	const hours = Math.round(minutes / 60);

	return `in ${hours} hour${hours === 1 ? "" : "s"}`;
}

function showFeedback(message)
{
	clearTimeout(feedbackTimer);
	feedbackText.textContent = message;
	feedbackTimer = setTimeout(() => { feedbackText.textContent = ""; }, FEEDBACK_TIMEOUT_MS);
}
