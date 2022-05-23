import * as path from "path";
import * as fs from "fs";
import type { IonApp } from "../IonApp";

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
				
				const appExportName = "App";

				const m = appModule[appExportName];

				if (!m)
				{
					console.warn(`App ${name} has no exports!`);
				}
				else if (!m.default)
				{
					console.warn(`App ${name} has no default export!`);
				}
				else
				{
					apps[name] = appModule[appExportName].default;
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
	[key: string]: IonApp.Component<any>;
};
