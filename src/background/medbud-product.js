import { readCached, writeCached } from "./http-cache.js";

const BASE_URL = "https://medbud.wiki";
const RATING_TTL_MS = 12 * 60 * 60 * 1000;

const AVERAGE_PATTERN = /\bAverage\s+(\d+(?:\.\d+)?)/i;
const RATING_COUNT_PATTERN = /(\d+)\s+Ratings?\b/i;
const REVIEW_COUNT_PATTERN = /(\d+)\s+Reviews?\b/i;
const MEDBUD_ID_PATTERN = /\bMB-\d{4,}\b/;

export async function loadProductRating(path)
{
	if (!path) throw new Error("path is required");

	const cacheKey = `rating:${path}`;
	const cached = await readCached(cacheKey);
	if (cached) return cached;

	const rating = await fetchProductRating(path);

	await writeCached(cacheKey, rating, RATING_TTL_MS);

	return rating;
}

async function fetchProductRating(path)
{
	const url = BASE_URL + path;
	const response = await fetch(url, { credentials: "include" });
	if (!response.ok) throw new Error(`MedBud product request failed with status ${response.status} for ${path}`);

	// The rating block has no stable class name, so the page is reduced to plain
	// text and read by its human-readable wording instead of by selector.
	const text = toPlainText(await response.text());

	return {
		url,
		average: readNumber(text, AVERAGE_PATTERN),
		ratingCount: readNumber(text, RATING_COUNT_PATTERN) ?? 0,
		reviewCount: readNumber(text, REVIEW_COUNT_PATTERN) ?? 0,
		medbudId: text.match(MEDBUD_ID_PATTERN)?.[0] ?? null
	};
}

function toPlainText(html)
{
	return html
		.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/\s+/g, " ");
}

function readNumber(text, pattern)
{
	const match = text.match(pattern);
	if (!match) return null;

	const value = Number.parseFloat(match[1]);

	return Number.isFinite(value) ? value : null;
}
