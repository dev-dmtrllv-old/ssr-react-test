import { Command } from "../Command";
import path from "path";
import fs from "fs";
import { promisify } from "util";

const initIonConfig = {
	apps: {
		App: {
			entry: "src/app/App.tsx",
			url: "/",
			title: "App"
		}
	},
	server: {
		entry: "src/server/index.tsx"
	}
};

const createPackageJson = (name: string) => ({
	"name": name,
	"version": "0.1.0",
	"scripts": {
		"start": "ion start",
		"watch": "ion watch",
		"build": "ion build"
	},
	"license": "ISC",
	"devDependencies": {
		"@types/react": "^18.0.9",
		"@types/react-dom": "^18.0.4",
		"@types/webpack-env": "^1.17.0",
		"fork-ts-checker-webpack-plugin": "^7.2.11",
		"source-map-loader": "^3.0.1",
		"ts-loader": "^9.3.0",
		"typescript": "^4.6.4",
		"webpack": "^5.72.1",
		"webpack-node-externals": "^3.0.0"
	},
	"dependencies": {
		"@types/body-parser": "^1.19.2",
		"@types/express": "^4.17.13",
		"@types/express-session": "^1.17.4",
		"@types/mysql": "^2.15.21",
		"@types/node": "^17.0.35",
		"body-parser": "^1.20.0",
		"css-loader": "^6.7.1",
		"express": "^4.18.1",
		"express-session": "^1.17.3",
		"file-loader": "^6.2.0",
		"ignore-loader": "^0.1.2",
		"mini-css-extract-plugin": "^2.6.0",
		"mysql": "^2.18.1",
		"node-sass": "^7.0.1",
		"raw-loader": "^4.0.2",
		"react": "^18.1.0",
		"react-dom": "^18.1.0",
		"sass-loader": "^13.0.0",
		"socket.io": "^4.5.1",
		"socket.io-client": "^4.5.1",
		"style-loader": "^3.3.1",
		"url-loader": "^4.1.1"
	}
});

const tsConfig = {
	"compilerOptions": {
		"jsx": "react",
		"allowSyntheticDefaultImports": true,
		"esModuleInterop": true,
		"exactOptionalPropertyTypes": true,
		"experimentalDecorators": true,
		"strictBindCallApply": true,
		"strictFunctionTypes": true,
		"strictNullChecks": true,
		"strictPropertyInitialization": true,
		"target": "es2017",
		"module": "esnext",
		"moduleResolution": "Node",
		"outDir": "dist",
		"rootDir": "src"
	},
	"include": [
		"./src/**/*"
	],
	"exclude": [
		"./node_modules/**/*"
	]
};

const appEntryScript = (name: string) => `import { Ion, Async } from "ion";
import React from "react";

export default Ion.createApp(() =>
{
	return (
		<div>
			Hi ${name}!
		</div>
	);
});
`

export default class New extends Command<NewArgs>
{
	public get argPattern(): { name: "?string"; path: "?string"; }
	{
		return { name: "?string", path: "?string" };
	}

	protected async onRun(args: NewArgs)
	{
		const p = path.resolve(process.cwd(), "ion.config.js");

		if (fs.existsSync(p))
		{
			const name = await this.ask("Name of the project", undefined, [], true);
		}
		else // create new project
		{
			if (!args.name)
				args.name = await this.ask("Name of the project", undefined, [], true);

			if (!args.path)
				args.path = path.resolve(process.cwd(), await this.ask("Path of the project", path.resolve(process.cwd(), args.name), [], true));

			if (fs.existsSync(args.path) && fs.existsSync(path.resolve(args.path, "ion.config.json")))
			{
				console.warn(`${args.path} already is an ion project!`);
			}
			else
			{
				console.log(`Creating ion project "${args.name}" in ${args.path}...`);

				const mkdir = (p: string) => promisify(fs.mkdir)(path.resolve(args.path!, p), { recursive: true });
				const writeFile = (p: string, data: string) => promisify(fs.writeFile)(path.resolve(args.path!, p), data, "utf-8");

				await Promise.all([
					mkdir("src/app"),
					mkdir("src/server"),
				]);

				await Promise.all([
					writeFile("src/app/App.tsx", appEntryScript("App")),
					writeFile("ion.config.json", JSON.stringify(initIonConfig, null, 4)),
					writeFile("tsconfig.json", JSON.stringify(tsConfig, null, 4)),
					writeFile("package.json", JSON.stringify(createPackageJson(args.name!), null, 4)),
				]);				
			}
		}
	}
}

type NewArgs = {
	name?: string;
	path?: string;
};
