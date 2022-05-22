import * as path from "path";
import * as fs from "fs";
import { IonAppComponent } from "./types";

export class AppConfig
{
	private readonly _data: ConfigData;

	public get data() { return this._data; }

	public constructor()
	{
		this._data = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "ion.config.json"), "utf-8"));
	}

	public loadAppComponents()
	{
		const distDir = process.cwd();

		const apps: AppComponents = {};

		for (const name in this.data.apps)
		{
			try
			{
				const appModule = __non_webpack_require__(path.resolve(distDir, `${name}.js`));
				if (!appModule[name])
				{
					console.warn(`App ${name} has no exports!`);
				}
				else if (!appModule[name].default)
				{
					console.warn(`App ${name} has no default export!`);
				}
				else
				{
					apps[name] = appModule[name].default
				}
			}
			catch (e: any)
			{
				console.error(e);
			}
		}

		return apps;
	}
}

export type ConfigData = {
	apps: {
		[name: string]: ConfigAppInfo;
	};
	server?: {
		entry: string;
		host?: string;
		port?: number;
	}
};

export type ConfigAppInfo = {
	entry: string;
	title?: string;
	url: string;
};

export type AppComponents = {
	[key: string]: IonAppComponent;
};
