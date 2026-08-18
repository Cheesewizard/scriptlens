import { MESSAGE_TYPES } from "../shared/messages.js";
import { loadSettings, saveSettings } from "../shared/settings.js";

const FEEDBACK_TIMEOUT_MS = 2500;

const minimumMatchScoreInput = document.getElementById("minimumMatchScore");
const minimumMatchScoreValue = document.getElementById("minimumMatchScoreValue");
const showUnmatchedProductsInput = document.getElementById("showUnmatchedProducts");
const debugLoggingInput = document.getElementById("debugLogging");
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
		statusText.textContent = `Formulary unavailable: ${response.reason}`;
		return;
	}

	statusText.textContent = `${response.result.indexedProducts} medications in the formulary bundled with the extension. Nothing is requested from MedBud; products it does not list fall back to a search.`;
}

function showFeedback(message)
{
	clearTimeout(feedbackTimer);
	feedbackText.textContent = message;
	feedbackTimer = setTimeout(() => { feedbackText.textContent = ""; }, FEEDBACK_TIMEOUT_MS);
}
