// Content scripts cannot be declared as ES modules in the manifest, so this
// classic script bootstraps the real module graph via a dynamic import.
import(chrome.runtime.getURL("src/content/main.js"))
	.catch(reason => console.error("[cb1-medbud] failed to load content module", reason));
