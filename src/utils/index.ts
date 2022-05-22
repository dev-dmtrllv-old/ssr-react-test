export * as react from "./react";
export * as string from "./string";
export * as object from "./object";
export * as math from "./math";
export * as path from "./path";

export const wait = (time: number, target: "ms" | "s" | "min" = "ms") => new Promise<NodeJS.Timeout>((resolve) => 
{
	let ms = target === "ms" ? time : target === "s" ? time * 1000 : time * 60000;
	return setTimeout(resolve, ms);
});

export const isSubClass = (A: any, B: any, matchSameClass: boolean = false) =>
{
	if (matchSameClass)
		return A.prototype instanceof B || B === A;
	return A.prototype instanceof B;
}

export const exec = <T = any>(fn: () => T) => fn();

export const tryCaych = <F extends Fn>(fn: F, ...params: Params<F>): Catcher<ReturnType<F>> =>
{
	return new Catcher(fn, params);
}

class Catcher<Value extends any, F extends Fn = Fn<any, any>>
{
	private readonly fn: F;
	private readonly params: Params<F>;
	private readonly callbacks: ErrorCallback<any>[];

	public constructor(fn: F, params: Params<F>, callbacks: ErrorCallback<any>[] = [])
	{
		this.fn = fn;
		this.params = params;
		this.callbacks = callbacks;
	}

	private readonly callErrorHandler = (e: Error) =>
	{
		let found = this.callbacks.find(s => 
		{
			if (e.constructor === s.type)
			{
				s.callback(e);
				return true;
			}
		});

		if (!found)
		{
			found = this.callbacks.find(s => 
			{
				if (isSubClass(e.constructor, s.type))
				{
					s.callback(e);
					return true;
				}
			});
		}

		if (!found)
		{
			throw e;
		}
	}

	public readonly catch = <E extends Error>(type: ErrorType<E>, callback: (error: E) => void): Catcher<Value, F> =>
	{
		this.callbacks.push({ type, callback });
		return new Catcher(this.fn, this.params, this.callbacks);
	}

	public readonly call = (...params: Parameters<F>): ReturnType<F> | undefined =>
	{
		try
		{
			return this.fn(...params) as ReturnType<F>;
		}
		catch (e: any)
		{
			this.callErrorHandler(e);
		}
		return undefined as any;
	}

	public readonly callAsync = async (...params: Parameters<F>): Promise<ReturnType<F> | undefined> =>
	{
		try
		{
			return (await this.fn(...params)) as any;
		}
		catch (e: any)
		{
			this.callErrorHandler(e);
		}
		return undefined as any;
	}
}

export class CancelToken<T extends any = any>
{
	private _isCanceled: boolean = false;
	private _reason: string | undefined;
	private readonly callback: ((reason?: string) => any) | undefined;
	public readonly data: Readonly<T> | undefined;

	public get canceledReason() { return this._reason; }

	public get isCanceled() { return this._isCanceled; }

	public constructor(data?: T, cancelCallback?: (reason?: string) => any)
	{ 
		this.data = data;
		this.callback = cancelCallback;
	}

	public cancel(reason?: string)
	{
		this._isCanceled = true;
		this._reason = reason;
	}
}

type Params<F extends Fn> = Parameters<F> extends [] ? [] : Parameters<F>;

type Fn<R = void, A extends any[] = any[]> = A extends never ? () => R : (...args: A) => R;

type ErrorType<E> = new (...args: any[]) => E;

type ErrorCallback<E extends Error> = {
	type: ErrorType<E>,
	callback: (error: E) => void;
};
