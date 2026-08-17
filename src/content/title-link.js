export const TITLE_LINK_CLASS = "medbud-title-link";

// The product title is the obvious thing to click, so it becomes a real anchor
// rather than a click handler: middle-click, context menu and "open in new tab"
// then all behave as expected.
//
// The title element belongs to the portal's React tree, so it is wrapped rather
// than rewritten — its own node, text and attributes are left untouched, and the
// wrapper uses `display: contents` so no box is introduced and the grid layout
// is unchanged. If React re-renders and drops the wrapper, the next scan simply
// puts it back.
export function linkTitle(title, url)
{
	if (!title) throw new Error("title is required");
	if (!url) throw new Error("url is required");

	const existing = enclosingLink(title);

	if (existing)
	{
		existing.href = url;
		return existing;
	}

	const link = document.createElement("a");
	link.className = TITLE_LINK_CLASS;
	link.href = url;
	link.target = "_blank";
	link.rel = "noopener noreferrer";

	// The whole card is clickable in the portal, and clicking the name should go
	// to MedBud rather than also opening the portal's own product page.
	link.addEventListener("click", (event) => event.stopPropagation());

	title.parentElement.insertBefore(link, title);
	link.append(title);

	return link;
}

// A recycled card can still be wrapped in a link to the previous product, which
// would otherwise send you to the wrong medication.
export function unlinkTitles(card)
{
	if (!card) throw new Error("card is required");

	for (const link of card.querySelectorAll(`.${TITLE_LINK_CLASS}`))
	{
		link.replaceWith(...link.childNodes);
	}
}

function enclosingLink(title)
{
	const parent = title.parentElement;

	return parent?.classList?.contains(TITLE_LINK_CLASS) ? parent : null;
}
