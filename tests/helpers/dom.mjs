// The content scripts run against a real browser DOM. linkedom supplies the
// document; the tests install it (and window) as globals, since modules that
// build elements reach for the global document exactly as they do in the browser.
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";

export function loadFixture(name)
{
	return install(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
}

export function parseFragment(html)
{
	return install(html);
}

function install(html)
{
	const { document, window } = parseHTML(html);

	globalThis.document = document;
	globalThis.window = window;

	return document;
}
