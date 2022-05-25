import { Request } from "express";
import { SessionData } from "express-session";

/**@ignore */
type SessionDataType = keyof SessionType extends never ? {} : SessionData;

export class Session
{
	private req: any;

	public constructor(req: Request)
	{
		this.req = req;
	}

	public save = () => new Promise<void>((res, rej) => 
	{
		this.req.session.save((err) => 
		{
			if(err)
				rej(err);
			else
				res();
		});
	});

	public clear = () => new Promise<void>((res, rej) => 
	{
		this.req.session.destroy((err) => 
		{
			if(err)
				rej(err);
			else
				res();
		});
	});

	public readonly get = <K extends keyof SessionDataType>(key: K, defaultValue: SessionDataType[K]): SessionDataType[K] =>
	{
		if (this.req.session[key] === undefined)
			this.req.session[key] = defaultValue;
		return this.req.session[key];
	}

	public readonly set = <K extends keyof SessionDataType>(key: K, data: SessionDataType[K]): SessionDataType[K] =>
	{
		this.req.session[key] = data;
		return data;
	}

	public readonly remove = <K extends keyof SessionDataType>(key: K) =>
	{
		delete this.req.session[key];
	}

	public readonly update = <K extends keyof SessionDataType>(key: K, updater: (oldValue: SessionDataType[K] | undefined) => SessionDataType[K]): SessionDataType[K] =>
	{
		const oldVal = this.req.session[key];
		const newVal = updater(oldVal);
		this.req.session[key] = newVal;
		return newVal;
	}
}
