const MAX_CONCURRENT_REQUESTS = 4;

const pending = [];

let activeCount = 0;

export function enqueue(task)
{
	if (typeof task !== "function") throw new Error("task must be a function");

	return new Promise((resolve, reject) =>
	{
		pending.push({ task, resolve, reject });
		drain();
	});
}

function drain()
{
	while (activeCount < MAX_CONCURRENT_REQUESTS && pending.length > 0)
	{
		const { task, resolve, reject } = pending.shift();
		activeCount += 1;

		Promise.resolve()
			.then(task)
			.then(resolve, reject)
			.finally(() =>
			{
				activeCount -= 1;
				drain();
			});
	}
}
