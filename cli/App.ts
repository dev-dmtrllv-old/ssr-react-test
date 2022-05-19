import * as fs from "fs";
import * as path from "path";
import { TsConfigSourceFile } from "typescript";
import { Compiler } from "./Compiler";
import { Config, ConfigSource } from "./Config";

export class App
{
	private static instance: App | null = null;

	public static get(): App
	{
		if (!this.instance)
			this.instance = new App();
		return this.instance;
	}

	public readonly projectPath: string;
	private _pkg: Package;
	private _tsConfig: any;

	private config: Config;

	private readonly compiler: Compiler;

	private constructor()
	{
		this.projectPath = process.cwd();
		this.config = new Config(this.getAppFile("ion.config.json"));
		this._pkg = this.getAppFile("package.json");
		this._tsConfig = this.getAppFile("tsconfig.json");

		this.compiler = new Compiler({
			aliases: this.getAliases(),
			entries: this.config.parsedEntries,
			outPath: this.resolvePath("dist"),
			name: this._pkg.name,
			serverEntry: this.config.serverEntry
		});
	}

	private getAliases()
	{
		const { baseUrl = ".", paths = {} } = this._tsConfig.compilerOptions;

		const aliases = {};

		Object.keys(paths).forEach(k =>
		{
			const prop = k.replace("/*", "").replace("./", "");

			if (!aliases[prop])
				aliases[prop] = this.resolvePath(baseUrl, paths[k][0]);
		});

		return aliases;
	}

	private getAppFile(resouce: string, onError: (e: Error) => void = (e) => { })
	{
		try
		{
			return JSON.parse(fs.readFileSync(`${this.projectPath}/${resouce}`, "utf-8"));
		}
		catch (e)
		{
			onError(e);
		}
	}

	private watchResource<K extends keyof AppResources>(resouce: string, key: K, onChange: (newData: AppResources[K]) => any = () => { })
	{
		const path = `${this.projectPath}/${resouce}`;
		fs.watchFile(path, { interval: 150 }, () => 
		{
			const newData = this.getAppFile(resouce);
			this[`_${key}` as any] = newData;
			onChange(newData);
		});
	}

	public watch()
	{
		this.watchResource("ion.config.json", "config", (data) => 
		{
			this.config.reset(data);
			this.compiler.updateAppEntries(this.config.parsedEntries);
			this.compiler.updateServerEntry(this.config.serverEntry);
			this.compiler.watch();
		});

		this.watchResource("tsconfig.json", "tsConfig", () => 
		{
			this.compiler.updateAliases(this.getAliases())
			this.compiler.watch();
		});

		this.watchResource("package.json", "pkg", (data) => 
		{
			this.compiler.updateName(data.name);
			this.compiler.watch();	
		});

		this.compiler.watch();
	}

	private resolvePath = (...parts: string[]) => path.resolve(this.projectPath, ...parts);
}

type AppResources = {
	pkg: Package;
	config: ConfigSource;
	tsConfig: any;
};

type VersionString<A extends string, B extends string, C extends string> = `${A}.${B}.${C}`;
type DepVersionString<A extends string, B extends string, C extends string> = `^${A}.${B}.${C}`;

type Package = {
	name: string;
	version: VersionString<any, any, any>;
	scripts?: {
		[key: string]: string;
	};
	dependencies?: {
		[key: string]: DepVersionString<any, any, any>;
	};
	devDependencies?: {
		[key: string]: DepVersionString<any, any, any>;
	};
	license?: string;
};
