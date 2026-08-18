export const BADGE_CLASS = "medbud-badge";
export const STRAIN_LINK_CLASS = "medbud-badge__leafly";

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
	badge.removeAttribute("title");

	// One link, one label. Whether the page was resolved directly or has to be
	// found through a search is an implementation detail the reader should never
	// have to think about — every card simply offers the way to its MedBud page.
	// A direct link is the overwhelmingly common case; the search is the rare
	// fallback for a rename or a product MedBud has not listed.
	if (rating.ratingsFetched !== true)
	{
		badge.dataset.state = "linked";

		const destination = rating.url ?? rating.searchUrl;
		if (destination) badge.append(buildLink(destination, "View on MedBud"));

		return;
	}

	if (rating.average === null || rating.ratingCount === 0)
	{
		badge.dataset.state = "unrated";
		badge.append(buildLink(rating.url, "Not yet rated"));
		return;
	}

	badge.dataset.state = "rated";
	badge.dataset.tier = toTier(rating.average, rating.bestRating);
	badge.title = describeRating(rating);
	badge.append(buildStars(rating.average, rating.bestRating), buildLink(rating.url, describeSummary(rating)));
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

// Cloudflare challenges cannot be answered by a background fetch, so this is a
// state the user can actually clear — say so, rather than reporting a failure
// that looks like a bug in the extension.
export function applyBlocked(badge, reason)
{
	if (!badge) throw new Error("badge is required");

	badge.replaceChildren();
	delete badge.dataset.tier;
	badge.dataset.state = "blocked";
	badge.title = reason ?? "MedBud is challenging automated requests.";

	// The medication index, not the home page: it is the request that is actually
	// being blocked, so loading it either clears the check or shows that the
	// browser is not the thing being challenged.
	badge.append(buildLink("https://medbud.wiki/strains/", "MedBud check needed"));
}

// A second provider on the same badge: MedBud carries the reviews, Leafly the
// terpene and effect profile. Appended after the MedBud content rather than
// built into it, so it survives the same whatever state the MedBud side is in.
export function appendStrainLink(badge, url)
{
	if (!badge) throw new Error("badge is required");
	if (!url || badge.querySelector(`.${STRAIN_LINK_CLASS}`)) return;

	const separator = document.createElement("span");
	separator.className = "medbud-badge__sep";
	separator.setAttribute("aria-hidden", "true");
	separator.textContent = "·";

	const link = buildLink(url, "Leafly");
	link.classList.add(STRAIN_LINK_CLASS);

	badge.append(separator, link);
}

function buildStars(average, bestRating)
{
	const stars = document.createElement("span");
	stars.className = "medbud-badge__stars";

	const track = document.createElement("span");
	track.className = "medbud-badge__stars-track";
	track.textContent = "★★★★★";

	const fill = document.createElement("span");
	fill.className = "medbud-badge__stars-fill";
	fill.textContent = "★★★★★";
	fill.style.width = `${clampPercentage((average / bestRating) * 100)}%`;

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

function describeSummary(rating)
{
	return `${rating.average.toFixed(2)} · ${rating.ratingCount} rating${rating.ratingCount === 1 ? "" : "s"}`;
}

// Shown on hover: the per-category breakdown is the part that usually decides
// whether a product is worth ordering, and it saves opening the page at all.
function describeRating(rating)
{
	const lines = rating.categories.map(category => `${category.label}: ${category.average.toFixed(1)}`);

	lines.push(`${rating.reviewCount} written review${rating.reviewCount === 1 ? "" : "s"}`);

	return lines.join("\n");
}

function toTier(average, bestRating)
{
	const fraction = average / bestRating;

	if (fraction >= 0.8) return "high";
	if (fraction >= 0.6) return "mid";

	return "low";
}

function clampPercentage(value)
{
	return Math.min(100, Math.max(0, value));
}
