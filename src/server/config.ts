import * as path from "path";
import * as fs from "fs";

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
		// const g: any = global;

		// if (!g.window)
		// 	g.window = {};

		// if (!g.self)
		// 	g.self = {};

		const distDir = process.cwd();
		
		const apps: AppComponents = {};

		for (const name in this.data.apps)
		{
			try
			{
				const appModule = __non_webpack_require__(path.resolve(distDir, "public/js", `${name}.bundle.js`));
				// console.log(appModule);
				if (appModule.default)
					apps[name] = appModule.default;
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

export type IonAppComponent = {
	render: () => void;
	resolve: () => void;
	renderToString: () => string;
};


type DllManifest = {
	name: string;
	content: {
		[key: string]: {
			id: number;
			buildMeta: {
				exportsType: string;
				defaultObject: string;
			};
			exports: string[];
		};
	};
};
