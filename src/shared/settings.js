const SETTINGS_KEY = "settings";

export const DEFAULT_SETTINGS = Object.freeze({
	minimumMatchScore: 0.45,

	// On by default: an unmatched product now offers a search that finds it,
	// rather than the bare "No MedBud entry" this once hid. Off, most of the grid
	// has no badge at all, which reads as the extension half-working.
	showUnmatchedProducts: true,

	// Where to refresh the shared name-to-medication mapping from. The catalogue
	// is identical for every patient, so one resolution serves everyone. Empty
	// means use only the mapping that ships with the extension.
	mappingUrl: "",

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
