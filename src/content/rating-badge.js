const BADGE_CLASS = "medbud-badge";
const MAXIMUM_RATING = 5;

export function createBadge()
{
	const badge = document.createElement("div");
	badge.className = BADGE_CLASS;
	badge.dataset.state = "loading";
	badge.textContent = "MedBud…";

	return badge;
}

export function applyRating(badge, rating)
{
	if (!badge) throw new Error("badge is required");
	if (!rating) throw new Error("rating is required");

	badge.replaceChildren();
	delete badge.dataset.tier;

	if (!rating.matched)
	{
		badge.dataset.state = "unmatched";
		badge.textContent = "No MedBud entry";
		return;
	}

	if (rating.average === null || rating.ratingCount === 0)
	{
		badge.dataset.state = "unrated";
		badge.append(buildLink(rating.url, "Not yet rated"));
		return;
	}

	badge.dataset.state = "rated";
	badge.dataset.tier = toTier(rating.average);
	badge.title = `MedBud match confidence ${(rating.matchScore * 100).toFixed(0)}%`;
	badge.append(buildStars(rating.average), buildLink(rating.url, buildSummary(rating)));
}

export function applyError(badge, reason)
{
	if (!badge) throw new Error("badge is required");

	badge.replaceChildren();
	delete badge.dataset.tier;
	badge.dataset.state = "error";
	badge.textContent = "MedBud lookup failed";
	badge.title = reason?.message ?? String(reason);
}

function buildStars(average)
{
	const stars = document.createElement("span");
	stars.className = "medbud-badge__stars";

	const track = document.createElement("span");
	track.className = "medbud-badge__stars-track";
	track.textContent = "★★★★★";

	const fill = document.createElement("span");
	fill.className = "medbud-badge__stars-fill";
	fill.textContent = "★★★★★";
	fill.style.width = `${clampPercentage((average / MAXIMUM_RATING) * 100)}%`;

	stars.append(track, fill);

	return stars;
}

function buildLink(url, label)
{
	const link = document.createElement("a");
	link.className = "medbud-badge__link";
	link.href = url;
	link.target = "_blank";
	link.rel = "noopener noreferrer";
	link.textContent = label;

	return link;
}

function buildSummary(rating)
{
	const ratings = `${rating.ratingCount} rating${rating.ratingCount === 1 ? "" : "s"}`;

	return `${rating.average.toFixed(2)} · ${ratings}`;
}

function toTier(average)
{
	if (average >= 4) return "high";
	if (average >= 3) return "mid";

	return "low";
}

function clampPercentage(value)
{
	return Math.min(100, Math.max(0, value));
}
