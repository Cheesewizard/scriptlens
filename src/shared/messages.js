export const MESSAGE_TYPES = Object.freeze({
	REQUEST_RATING: "requestRating",
	REFRESH_INDEX: "refreshIndex",
	CLEAR_CACHE: "clearCache",
	GET_STATUS: "getStatus"
});

// Returned as `code` on a failed response when Cloudflare challenged the
// request. Lives here because both sides of the message channel need it: the
// service worker sets it, the content script renders a different badge for it.
export const CHALLENGED_CODE = "medbud-challenged";
