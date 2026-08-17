// Words that appear in CB1 product titles or MedBud slugs without helping to
// identify the medication. Removing them stops them inflating the union size
// and dragging otherwise perfect matches below the threshold.
const NOISE_TOKENS = new Set([
	"flower", "smalls", "medical", "cannabis", "cbmp", "strain",
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

export function tokenisePath(path)
{
	if (typeof path !== "string") throw new Error("path must be a string");

	return tokenise(path.replace(/^\/strains\//, ""));
}

export function findBestMatch(title, productPaths, minimumScore)
{
	if (!Array.isArray(productPaths)) throw new Error("productPaths must be an array");
	if (!(minimumScore > 0 && minimumScore <= 1)) throw new Error("minimumScore must be between 0 and 1");

	const titleTokens = new Set(tokenise(title));
	if (titleTokens.size === 0) return null;

	const titlePotencies = filterPotencies(titleTokens);

	let best = null;

	for (const path of productPaths)
	{
		const candidateTokens = new Set(tokenisePath(path));
		if (candidateTokens.size === 0) continue;

		// The THC/CBD code (T30, T7, C10) is the single most discriminating part
		// of a medication name, so a mismatch there rules the candidate out
		// regardless of how much of the strain name happens to overlap.
		if (!sharesPotency(titlePotencies, filterPotencies(candidateTokens))) continue;

		const score = jaccardSimilarity(titleTokens, candidateTokens);
		if (score < minimumScore) continue;
		if (best !== null && score <= best.score) continue;

		best = { path, score };
	}

	return best;
}

function filterPotencies(tokens)
{
	const potencies = new Set();

	for (const token of tokens)
	{
		if (POTENCY_PATTERN.test(token)) potencies.add(token);
	}

	return potencies;
}

function sharesPotency(left, right)
{
	if (left.size === 0 || right.size === 0) return true;

	for (const token of left)
	{
		if (right.has(token)) return true;
	}

	return false;
}

function jaccardSimilarity(left, right)
{
	let intersection = 0;

	for (const token of left)
	{
		if (right.has(token)) intersection += 1;
	}

	return intersection / (left.size + right.size - intersection);
}
