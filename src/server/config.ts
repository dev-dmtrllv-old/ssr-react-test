import * as path from "path";
import * as fs from "fs";

const g: any = global;
g.window = {};
g.self = {};

let vendor: (id: number) => any = () => { };

let config = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "ion.config.json"), "utf-8"));

export const getConfig = (): Config => config;

export const getAppComponents = () =>
{
	const distDir = process.cwd();
	const manifest: DllManifest = JSON.parse(fs.readFileSync(path.resolve(distDir, "public/js/vendors-manifest.json"), "utf-8"));
	vendor = __non_webpack_require__(path.resolve(distDir, "./public/js/vendors.bundle.js"));
	global[manifest.name] = vendor;
	global.window[manifest.name] = vendor;
	global.self[manifest.name] = vendor;

	const apps: AppComponents = {};

	for (const name in config.apps)
	{
		try
		{
			const appModule = __non_webpack_require__(path.resolve(distDir, "public/js", `${name}.bundle.js`));

			if (appModule.default)
				apps[name] = appModule.default;
		}
		catch (e: any)
		{
			console.warn(e.message);
		}
	}

	return apps;
}

export type Config = {
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
