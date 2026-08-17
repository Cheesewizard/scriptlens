// The content scripts run against a real browser DOM. linkedom supplies the
// document, but not `CSS`, which card-scanner uses to build attribute
// selectors — so the tests install the CSSOM-spec escape rather than an
// approximation, or they would be testing different escaping to production.
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

// Content scripts run with `document` and `CSS` as globals, so the tests give
// them the same shape — modules that build elements reach for the global
// document exactly as they do in the browser.
function install(html)
{
	const { document, window } = parseHTML(html);

	if (!globalThis.CSS) globalThis.CSS = { escape: cssEscape };

	globalThis.document = document;
	globalThis.window = window;

	return document;
}

// https://drafts.csswg.org/cssom/#the-css.escape()-method
function cssEscape(value)
{
	const string = String(value);
	const firstCodeUnit = string.charCodeAt(0);
	let result = "";

	for (let index = 0; index < string.length; index += 1)
	{
		const codeUnit = string.charCodeAt(index);

		if (codeUnit === 0x0000)
		{
			result += "�";
			continue;
		}

		const isControl = (codeUnit >= 0x0001 && codeUnit <= 0x001f) || codeUnit === 0x007f;
		const isLeadingDigit = index === 0 && codeUnit >= 0x0030 && codeUnit <= 0x0039;
		const isDigitAfterLeadingHyphen = index === 1 && codeUnit >= 0x0030 && codeUnit <= 0x0039 && firstCodeUnit === 0x002d;

		if (isControl || isLeadingDigit || isDigitAfterLeadingHyphen)
		{
			result += `\\${codeUnit.toString(16)} `;
			continue;
		}

		if (index === 0 && string.length === 1 && codeUnit === 0x002d)
		{
			result += `\\${string.charAt(index)}`;
			continue;
		}

		const isSafe = codeUnit >= 0x0080
			|| codeUnit === 0x002d
			|| codeUnit === 0x005f
			|| (codeUnit >= 0x0030 && codeUnit <= 0x0039)
			|| (codeUnit >= 0x0041 && codeUnit <= 0x005a)
			|| (codeUnit >= 0x0061 && codeUnit <= 0x007a);

		result += isSafe ? string.charAt(index) : `\\${string.charAt(index)}`;
	}

	return result;
}
