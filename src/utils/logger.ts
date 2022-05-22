import { exec } from "../utils";

export namespace Logger
{
	let disableCount = 0;

	const consoleClone = exec(() => 
	{
		let o: any = {};
		Object.keys(console).forEach((k) => o[k] = (console as any)[k]);
		return o;
	});

	const emptyConsole = exec(() => 
	{
		let o: any = {};
		Object.keys(console).forEach((k) => o[k] = () => { });
		return o;
	});

	export const runWith = (cb: () => any) =>
	{
		let o: any = {};
		Object.keys(console).forEach((k) => o[k] = (console as any)[k]);
		Object.keys(console).forEach((k) => (console as any)[k] = consoleClone[k]);
		const r = cb();
		Object.keys(console).forEach((k) => (console as any)[k] = o[k]);
		return r;
	}

	export const runWithout = (cb: () => any) =>
	{
		disable();
		cb();
		enable();
	}

	export const disable = () =>
	{
		if (disableCount === 0)
			Object.keys(console).forEach((k) => (console as any)[k] = emptyConsole[k]);
		disableCount++;
	}

	export const enable = () =>
	{
		disableCount--;
		if (disableCount === 0)
			Object.keys(console).forEach((k) => (console as any)[k] = consoleClone[k]);
	}
};
