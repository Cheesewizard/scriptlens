import { readCached, writeCached } from "./http-cache.js";
import { fetchMedBudText } from "./medbud-request.js";

const BASE_URL = "https://medbud.wiki";

// Ratings accumulate slowly, but not so slowly that a stale figure should sit
// there for a day.
export const RATING_TTL_MS = 6 * 60 * 60 * 1000;

// MedBud publishes schema.org AggregateRating microdata, which is far more stable
// than either its visible wording or its CSS classes.
const AGGREGATE_BLOCK_PATTERN = /id="review-aggregate-rating"[\s\S]{0,600}?<\/div>/i;
const CATEGORY_TABLE_PATTERN = /<table class="review-details">([\s\S]*?)<\/table>/i;
const CATEGORY_ROW_PATTERN = /<td>([\s\S]*?)<\/td>[\s\S]*?<td>\s*([\d.]+)\s*<span class="quiet">/gi;
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
	const html = await fetchMedBudText(url, { label: path });

	return { url, ...readAggregateRating(html), categories: readCategoryRatings(html), medbudId: html.match(MEDBUD_ID_PATTERN)?.[0] ?? null };
}

export function readAggregateRating(html)
{
	const block = html.match(AGGREGATE_BLOCK_PATTERN)?.[0];

	if (!block) return { average: null, bestRating: 5, ratingCount: 0, reviewCount: 0 };

	return {
		average: readMeta(block, "ratingValue"),
		bestRating: readMeta(block, "bestRating") ?? 5,
		ratingCount: readMeta(block, "ratingCount") ?? 0,
		reviewCount: readMeta(block, "reviewCount") ?? 0
	};
}

export function readCategoryRatings(html)
{
	const table = html.match(CATEGORY_TABLE_PATTERN)?.[1];
	if (!table) return [];

	const categories = [];

	for (const match of table.matchAll(CATEGORY_ROW_PATTERN))
	{
		const label = stripMarkup(match[1]).replace(/\*$/, "").trim();
		const average = Number.parseFloat(match[2]);

		if (label.length > 0 && Number.isFinite(average)) categories.push({ label, average });
	}

	return categories;
}

function readMeta(block, property)
{
	const match = block.match(new RegExp(`itemprop="${property}"\\s+content="([\\d.]+)"`, "i"));
	if (!match) return null;

	const value = Number.parseFloat(match[1]);

	return Number.isFinite(value) ? value : null;
}

function stripMarkup(fragment)
{
	return fragment
		.replace(/<[^>]+>/g, "")
		.replace(/&amp;/gi, "&")
		.replace(/&nbsp;/gi, " ")
		.replace(/\s+/g, " ");
}
