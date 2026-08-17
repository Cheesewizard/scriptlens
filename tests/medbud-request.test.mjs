import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { fetchMedBudText, isChallenged, clearChallenge, MedBudChallengeError } from "../src/background/medbud-request.js";
import { CHALLENGED_CODE } from "../src/shared/messages.js";

// Captured from a real challenged response: Cloudflare labels the mitigation in
// a header and serves the interstitial with a 403.
const CHALLENGE_BODY = "<html><head><title>Security Check &bull; MedBud&reg;</title></head><body>Just a moment...</body></html>";

function respondWith({ status = 200, headers = {}, body = "<html></html>" } = {})
{
	globalThis.fetch = async () => new Response(body, { status, headers });
}

beforeEach(() =>
{
	clearChallenge();
});

test("returns the body for a normal response", async () =>
{
	respondWith({ body: "<html>ok</html>" });

	assert.equal(await fetchMedBudText("https://medbud.wiki/strains/"), "<html>ok</html>");
	assert.equal(isChallenged(), false);
});

test("treats a cf-mitigated response as a challenge", async () =>
{
	respondWith({ status: 403, headers: { "cf-mitigated": "challenge" }, body: CHALLENGE_BODY });

	await assert.rejects(() => fetchMedBudText("https://medbud.wiki/strains/"), (thrown) =>
	{
		assert.ok(thrown instanceof MedBudChallengeError);
		assert.equal(thrown.code, CHALLENGED_CODE);
		assert.match(thrown.message, /Open https:\/\/medbud\.wiki/);
		return true;
	});
});

// Cloudflare does not always send the header, so the interstitial body is a
// second signal — but only on the statuses it actually uses.
test("recognises the challenge body without the header", async () =>
{
	respondWith({ status: 403, body: CHALLENGE_BODY });

	await assert.rejects(() => fetchMedBudText("https://medbud.wiki/strains/"), MedBudChallengeError);
});

test("does not mistake an ordinary 403 for a challenge", async () =>
{
	respondWith({ status: 403, body: "<html>Forbidden</html>" });

	await assert.rejects(() => fetchMedBudText("https://medbud.wiki/strains/"), (thrown) =>
	{
		assert.ok(!(thrown instanceof MedBudChallengeError));
		assert.match(thrown.message, /status 403/);
		return true;
	});
});

test("fails fast while challenged instead of firing a request per card", async () =>
{
	respondWith({ status: 403, headers: { "cf-mitigated": "challenge" }, body: CHALLENGE_BODY });
	await assert.rejects(() => fetchMedBudText("https://medbud.wiki/strains/"), MedBudChallengeError);

	assert.equal(isChallenged(), true);

	let called = false;
	globalThis.fetch = async () => { called = true; return new Response("<html></html>", { status: 200 }); };

	await assert.rejects(() => fetchMedBudText("https://medbud.wiki/strains/lit/white-fire/"), MedBudChallengeError);
	assert.equal(called, false, "a challenged extension should not keep hitting the network");
});

test("clears the challenge once a request gets through", async () =>
{
	respondWith({ status: 403, headers: { "cf-mitigated": "challenge" }, body: CHALLENGE_BODY });
	await assert.rejects(() => fetchMedBudText("https://medbud.wiki/strains/"), MedBudChallengeError);

	clearChallenge();
	respondWith({ body: "<html>back</html>" });

	assert.equal(await fetchMedBudText("https://medbud.wiki/strains/"), "<html>back</html>");
	assert.equal(isChallenged(), false);
});
