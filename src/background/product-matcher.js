// Words that appear in CB1 titles or MedBud slugs without helping to identify the
// medication. Removing them stops them from diluting the similarity score.
const NOISE_TOKENS = new Set([
	"flower", "smalls", "minis", "medical", "cannabis", "cbmp", "strain",
	"vape", "cartridge", "oil", "drops", "pastille", "pastilles", "capsule", "capsules",
	"irradiated", "gamma", "beta", "non", "the", "and"
]);

const POTENCY_PATTERN = /^[tc]\d{1,3}$/;
const WEIGHT_PATTERN = /^\d{1,3}(g|ml|mg)$/;

export function tokenise(text)
{
	if (typeof text !== "string") throw new Error("text must be a string");

	const words = text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

	if (words.length === 0) return [];

	return words
		.split(" ")
		.filter(word => !NOISE_TOKENS.has(word) && !WEIGHT_PATTERN.test(word));
}

// The short code sitting immediately before the potency: WF, CCK, TT-M, SCK-S.
// It is the part of a medication name that distinguishes products which are
// otherwise identical, so it gets checked separately from the overall similarity.
export function readProductCode(tokens)
{
	const potencyIndex = tokens.findIndex(token => POTENCY_PATTERN.test(token));
	if (potencyIndex <= 0) return null;

	const parts = [];
	let index = potencyIndex - 1;

	while (index >= 0 && tokens[index].length === 1)
	{
		parts.unshift(tokens[index]);
		index -= 1;
	}

	if (index >= 0) parts.unshift(tokens[index]);
	if (parts.length === 0) return null;

	return parts.join("");
}

export function describeTitle(title)
{
	const tokens = tokenise(title);

	return {
		tokens: new Set(tokens),
		potencies: new Set(tokens.filter(token => POTENCY_PATTERN.test(token))),
		code: readProductCode(tokens),
		compact: tokens.join("")
	};
}

export function describeCandidate(path)
{
	if (typeof path !== "string") throw new Error("path must be a string");

	const [brandSegment = "", productSegment = ""] = path.replace(/^\/strains\//, "").replace(/\/$/, "").split("/");
	const brandTokens = tokenise(brandSegment);
	const productTokens = tokenise(productSegment);
	const tokens = [...brandTokens, ...productTokens];

	return {
		path,
		tokens: new Set(tokens),
		potencies: new Set(tokens.filter(token => POTENCY_PATTERN.test(token))),
		// Tokens that actually name the product, as opposed to the brand and the
		// potency. MedBud has slugs as bare as "/strains/all-nations/t28/", which
		// would otherwise match any product from that brand at that potency.
		contentTokens: new Set(productTokens.filter(token => !POTENCY_PATTERN.test(token))),
		code: readProductCode(productTokens),
		compact: tokens.join("")
	};
}

export function findBestMatch(title, candidates, minimumScore)
{
	if (!Array.isArray(candidates)) throw new Error("candidates must be an array");
	if (!(minimumScore > 0 && minimumScore <= 1)) throw new Error("minimumScore must be between 0 and 1");

	const described = describeTitle(title);
	if (described.tokens.size === 0) return null;

	let best = null;

	for (const candidate of candidates)
	{
		const resolved = typeof candidate === "string" ? describeCandidate(candidate) : candidate;
		const score = scoreCandidate(described, resolved);

		if (score < minimumScore) continue;
		if (best !== null && score <= best.score) continue;

		best = { path: resolved.path, score };
	}

	return best;
}

function scoreCandidate(title, candidate)
{
	if (candidate.contentTokens.size === 0) return 0;
	if (!sharesToken(title.potencies, candidate.potencies)) return 0;
	if (!sharesToken(title.tokens, candidate.contentTokens)) return 0;
	if (!codesAgree(title.code, candidate.code)) return 0;

	// CB1 writes "L.A. S.A.G.E." where MedBud writes "la-sage": the same name
	// tokenises differently but collapses to an identical run of characters.
	if (candidate.compact === title.compact) return 1;

	return harmonicOverlap(title.tokens, candidate.tokens);
}

// MedBud sometimes drops a suffix from the code, listing "XK" for CB1's "XK-S",
// so a prefix counts as agreement while a genuine difference does not.
function codesAgree(left, right)
{
	if (left === null || right === null) return true;

	return left.startsWith(right) || right.startsWith(left);
}

function sharesToken(left, right)
{
	if (left.size === 0 || right.size === 0) return left.size === right.size;

	for (const token of left)
	{
		if (right.has(token)) return true;
	}

	return false;
}

// The harmonic mean of how much of the title the candidate covers and how much of
// the candidate the title covers. Symmetric like Jaccard, but forgiving of MedBud
// slugs that abbreviate a longer CB1 title.
function harmonicOverlap(left, right)
{
	let intersection = 0;

	for (const token of left)
	{
		if (right.has(token)) intersection += 1;
	}

	if (intersection === 0) return 0;

	return (2 * intersection) / (left.size + right.size);
}
