import * as path from "path";
import * as fs from "fs";

let config = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "ion.config.json"), "utf-8"));

export const getConfig = (): Config => config;

export const getAppComponents = async () =>
{
	const g: any = global;
	
	g.window = {};
	g.self = {};

	const distDir = process.cwd();
	
	const apps: AppComponents = {};

	__non_webpack_require__(path.resolve(distDir, "./public/js/runtime.bundle.js"));
	__non_webpack_require__(path.resolve(distDir, "./public/js/vendors.bundle.js"));
	
	for(const name in config.apps)
	{
		try
		{
			__non_webpack_require__(path.resolve(distDir, "public/js", `${name}.bundle.js`));

			if (g.umdApp)
				apps[name] = g.umdApp;
			
			g.umdApp = undefined;
		}
		catch(e: any)
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
    [key: string]: React.FC<{}>;
};
