import fs from "fs";
import path from "path";
import readline from "readline";

export abstract class Command<T = undefined>
{
	private static readonly commands: { [key: string]: Command<any>; } = {};

	static {
		const p = path.resolve(__dirname, "commands");

		fs.readdirSync(p).forEach(file => 
		{
			if (file.endsWith(".js"))
			{
				const m = require(path.resolve(__dirname, "commands", file));
				const name = file.substring(0, file.length - 3).toLowerCase();
				if (m.default)
				{
					this.commands[name] = new m.default(name);
				}
				else
				{
					console.warn(`No default export found for Command ${name} (file: ${path.resolve(p, file)})`);
				}
			}
		});
	};

	public static run<T>(command: string = "help", args: string[])
	{
		const cmd = this.commands[command];
		if (cmd)
			cmd.run(args);

	}

	public readonly name: string;

	protected constructor(name: string)
	{
		this.name = name;
	}

	protected readonly ask = (what: string, defaultVal?: string, validResults?: string[], retry: boolean = false): Promise<string> => new Promise<string>((res) =>
	{
		const c = readline.createInterface(process.stdin, process.stdout);

		c.question(what + (defaultVal ? ` (${defaultVal}): ` : ": "), async (data) => 
		{
			c.close();

			if (!data && defaultVal)
				data = defaultVal;

			if (!data && retry)
				data = await this.ask(what, defaultVal, validResults, retry);
			else if (validResults && validResults.length > 0 && !validResults.includes(data))
				data = await this.ask(what, defaultVal, validResults, retry);

			res(data);
		});
	});

	public abstract get argPattern(): ArgPattern<T>;

	protected abstract onRun(args: T): any;

	public async run(args: string[])
	{
		let argObj: any = undefined;

		if (args.length <= 1)
		{
			argObj = args[0];
		}
		else
		{
			argObj = {};

			let key: string | undefined = undefined;
			let val: any = undefined;

			args.forEach((arg, i) => 
			{
				if (arg[0] == "-")
				{
					if (key)
					{
						if (!val)
						{
							argObj[key] = true;
						}
						else
						{
							argObj[key] = val;
						}
					}

					val = undefined;
					key = arg.substring(1, arg.length);
				}
				else
				{
					if (val === undefined)
						val = arg;
					else if (Array.isArray(val))
						val.push(arg);
					else
						val = [val, arg];
				}
			});

			if (key && !val)
				argObj[key] = true;
			else if (key && val)
				argObj[key] = val;
			else if (!key && val)
				argObj[val] = val;


			const p = this.argPattern;

			let missing: string[] = [];

			if (typeof p === "object")
			{
				Object.keys(p).forEach((k) => 
				{
					let t: string = p[k];
					let isArray = false;
					let isOptional = false;
					if (t.startsWith("?"))
					{
						t = t.substring(1, t.length);
						isOptional = true;
					}
					if (t.endsWith("[]"))
					{
						t = t.substring(0, t.length - 2);
						isArray = true;
					}
					const v = argObj[k];

					if ((v === undefined) && isOptional)
					{
						missing.push(k);
					}
					else if (v)
					{
						if (isArray)
						{
							if (!Array.isArray(v))
							{

								if (v !== undefined)
									argObj[k] = [v];
								else
									argObj[k] = [];
							}
							argObj[k] = argObj[k].map(s => 
							{
								if (typeof s !== t)
								{
									if (t === "number")
										return Number(s);
									else if (t === "boolean")
										return s === "true";
									return s;
								}
							});
						}
						else if (typeof v !== t)
						{
							if (t === "number")
								argObj[k] = Number(v);
							else if (t === "boolean")
								argObj[k] = v === "true";
						}
					}
				});
			}
			else
			{
				if (typeof argObj !== p)
				{
					if (p === "number")
						argObj = Number(argObj);
					else if (p === "boolean")
						argObj = argObj === "true";
				}
			}
		}

		await this.onRun(typeof argObj === "undefined" ? {} : argObj);
	}
}

type ArgPattern<T> = T extends undefined ? "none" : T extends {} ? {
	[K in keyof T]-?: K extends OptionalKeys<T> ? `?${TypeString<T[K]>}` : TypeString<T[K]>;
} : TypeString<T>;

type KeysOfType<T, U> = { [K in keyof T]: T[K] extends U ? K : never }[keyof T];
type RequiredKeys<T> = Exclude<KeysOfType<T, Exclude<T[keyof T], undefined>>, undefined>;
type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>;

type TypeString<T> =
	Exclude<T, undefined> extends Array<infer R> ? `${TypeString<R>}[]` :
	T extends number ? "number" :
	T extends boolean ? "boolean" :
	T extends string ? "string" : "none";
