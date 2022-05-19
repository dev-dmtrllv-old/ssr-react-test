export class Config
{
	private source: ConfigSource;

	public get rawSource() { return JSON.stringify(this.source); }

	public constructor(source: ConfigSource)
	{
		this.source = source;
	}

	public reset(source:ConfigSource)
	{
		this.source = source;
	}

	public get parsedEntries()
	{
		const entries: { [key: string]: string } = {};

		for (const k in this.source.apps)
		{
			const e = this.source.apps[k].entry;
			const p = e.startsWith("./") ? e : `./${e}`;
			entries[k] = p;
		}

		return entries;
	}

	public get serverEntry()
	{
		const e = this.source.server?.entry;
		
		if(e)
			return e.startsWith("./") ? e : `./${e}`;
		
		return "./src/server/index.ts";
	}
}

export type ConfigSource = {
	apps: {
		[name: string]: {
			entry: string;
			title?: string;
		};
	};
	server?: {
		entry: string;
	}
};
