const SETTINGS_KEY = "settings";

export const DEFAULT_SETTINGS = Object.freeze({
	minimumMatchScore: 0.45,

	// Off by default: MedBud is behind Cloudflare bot mitigation that refuses the
	// extension's background fetches outright, so leaving this on would mean
	// every card reporting a block. With it off nothing is fetched from MedBud at
	// all — the bundled formulary resolves the link, and the rating is read by
	// following it. Worth turning on again if MedBud's protection relaxes.
	liveRatings: false,

	// On by default: an unmatched product now offers a search that finds it,
	// rather than the bare "No MedBud entry" this once hid. Off, most of the grid
	// has no badge at all, which reads as the extension half-working.
	showUnmatchedProducts: true,

	// Where to refresh the shared name-to-medication mapping from. The catalogue
	// is identical for every patient, so one resolution serves everyone and no
	// user needs a search key of their own. Empty means use only the mapping that
	// ships with the extension.
	mappingUrl: "",

	// A Brave Search API key. Without one, a product the formulary does not list
	// links to a search page you finish by hand; with one, the extension asks the
	// search API on hover and the card links straight to the medication. The
	// search engine is queried, never MedBud — MedBud is only ever opened by you
	// clicking the link.
	searchApiKey: "",

	debugLogging: false
});

export async function loadSettings()
{
	const stored = await chrome.storage.sync.get(SETTINGS_KEY);

	return { ...DEFAULT_SETTINGS, ...stored[SETTINGS_KEY] };
}

export async function saveSettings(settings)
{
	if (!settings) throw new Error("settings is required");

	const merged = { ...DEFAULT_SETTINGS, ...settings };

	if (!(merged.minimumMatchScore > 0 && merged.minimumMatchScore <= 1)) throw new Error("minimumMatchScore must be between 0 and 1");

	await chrome.storage.sync.set({ [SETTINGS_KEY]: merged });
}
