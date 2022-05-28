import { Command } from "../Command";
import path from "path";
import fs from "fs";
import { promisify } from "util";
import { spawn } from "child_process";
import os from "os";

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
	"license": "ISC"
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
        "outDir": "./dist",
        "rootDir": "./src",
		"lib": [
			"DOM",
			"DOM.Iterable",
			"ES2015",
			"ES2016",
			"ES2017",
			"ES2018",
			"ES2019",
			"ES2020",
			"ES2021"
		]
    },
    "include": [
        "./src/**/*"
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
			console.log(`TODO!!! add apps to ion config!`);
			// const name = await this.ask("Name of the project", undefined, [], true);
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

				const npm = `npm${os.platform() === "win32" ? ".cmd" : ""}`

				let p = spawn(npm, ["i", "ion-ssr"], { cwd: args.path!, stdio: "inherit" });

				p.stdout = process.stdout;
				p.stderr = process.stderr;
				p.stdin = process.stdin;
			}
		}
	}
}

type NewArgs = {
	name?: string;
	path?: string;
};
