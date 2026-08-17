import { CHALLENGED_CODE } from "../shared/messages.js";
import { debug } from "../shared/logging.js";

// MedBud sits behind Cloudflare bot mitigation. A background fetch cannot run an
// interactive challenge, so once challenged every request fails the same way
// until the user visits MedBud in a tab and clears it. Reporting that as a bare
// "status 403" sends people looking for a bug in the matching instead.

// While challenged, fail fast rather than firing one blocked request per card.
// The whole grid would otherwise hammer a wall it cannot pass.
const CHALLENGE_BACKOFF_MS = 5 * 60 * 1000;

const CHALLENGE_BODY_MARKERS = ["cf-challenge", "cf_chl", "Just a moment", "Security Check", "challenge-platform"];

let challengedUntil = 0;

export class MedBudChallengeError extends Error
{
	constructor()
	{
		super("MedBud is challenging automated requests. Open https://medbud.wiki in a tab, complete the check, then reload this page.");
		this.name = "MedBudChallengeError";
		this.code = CHALLENGED_CODE;
	}
}

export function isChallenged()
{
	return Date.now() < challengedUntil;
}

export function clearChallenge()
{
	challengedUntil = 0;
}

// Credentials are included so a signed-in MedBud session — and the Cloudflare
// clearance cookie from ordinary browsing — are both honoured.
export async function fetchMedBudText(url, { label = url } = {})
{
	if (isChallenged()) throw new MedBudChallengeError();

	const response = await fetch(url, { credentials: "include" });

	if (await isChallengeResponse(response))
	{
		challengedUntil = Date.now() + CHALLENGE_BACKOFF_MS;
		debug(`MedBud challenged the request for ${label}; backing off for ${CHALLENGE_BACKOFF_MS / 60000} minutes`);

		throw new MedBudChallengeError();
	}

	if (!response.ok) throw new Error(`MedBud request failed with status ${response.status} for ${label}`);

	// A request that got through means any earlier challenge has been cleared.
	clearChallenge();

	return response.text();
}

async function isChallengeResponse(response)
{
	// Cloudflare labels mitigated responses outright, and extension fetches carry
	// host permissions, so the header is readable rather than CORS-hidden.
	if (response.headers.get("cf-mitigated") === "challenge") return true;

	if (response.status !== 403 && response.status !== 503) return false;

	const body = await response.clone().text();

	return CHALLENGE_BODY_MARKERS.some((marker) => body.includes(marker));
}
