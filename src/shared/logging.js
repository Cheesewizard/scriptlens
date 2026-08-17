const PREFIX = "[cb1-medbud]";

let isDebugEnabled = false;

export function setDebugLogging(enabled)
{
	isDebugEnabled = enabled === true;
}

export function debug(...parts)
{
	if (!isDebugEnabled) return;

	console.debug(PREFIX, ...parts);
}

export function warn(...parts)
{
	console.warn(PREFIX, ...parts);
}

export function error(...parts)
{
	console.error(PREFIX, ...parts);
}
