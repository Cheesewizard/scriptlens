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

// One link, one label. Whether the page was resolved directly or has to be found
// through a search is an implementation detail the reader never has to think
// about — every card simply offers the way to its MedBud page. A direct link is
// the overwhelmingly common case; the search is the rare fallback for a rename
// or a product MedBud has not listed.
export function applyRating(badge, result)
{
	if (!badge) throw new Error("badge is required");
	if (!result) throw new Error("result is required");

	badge.replaceChildren();
	badge.dataset.state = "linked";

	const destination = result.url ?? result.searchUrl;
	if (destination) badge.append(buildLink(destination, "View on MedBud"));
}

export function applyError(badge, reason)
{
	if (!badge) throw new Error("badge is required");

	badge.dataset.state = "error";
	badge.textContent = "MedBud lookup failed";
	badge.title = reason?.message ?? String(reason);
}

// A second provider on the same badge: MedBud carries the reviews, Leafly the
// terpene and effect profile.
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
