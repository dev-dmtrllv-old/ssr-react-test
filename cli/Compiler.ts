import webpack, { DefinePlugin, DllPlugin, DllReferencePlugin, } from "webpack";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import nodeExternals from "webpack-node-externals";
import * as fs from "fs";
import path from "path";

const VENDORS_MANIFEST_PATH = "public/js/vendors-manifest.json";

export class Compiler
{

	private static createDllConfig(config: CompilerConfig): webpack.Configuration
	{
		return {
			mode: config.dev ? "development" : "production",
			entry: {
				vendor: ["react-dom", "react"],
			},
			output: {
				filename: "vendors.bundle.js",
				path: path.resolve(config.outPath, "public", "js"),
				libraryTarget: "umd",
				globalObject: "window",
				library: {
					type: "umd",
					name: "vendors_lib"
				},
			},
			plugins: [
				new webpack.DllPlugin({
					name: "vendors_lib",
					path: path.resolve(config.outPath, VENDORS_MANIFEST_PATH),
					context: path.resolve(config.outPath, ".."),
					entryOnly: false
				})
			]
		};
	}

	private static createConfig(config: CompilerConfig, isServer: boolean): webpack.Configuration
	{
		const appEntries = isServer ? Object.keys(config.entries) : [];

		const libOptions = isServer ? {} : {
			library: {
				type: "umd",
				name: "App"
			},
			libraryTarget: "umd",
			globalObject: "window",
		};

		const options = isServer ? { target: "node", externalsPresets: { node: true } } : {};

		return {
			...options,
			mode: config.dev ? "development" : "production",
			name: config.name,
			devtool: config.dev ? "source-map" : false,
			entry: isServer ? config.serverEntry : config.entries,
			output: {
				filename: isServer ? `[name].js` : `js/[name].bundle.js`,
				chunkFilename: isServer ? `[id].js` : `js/[name].[id].chunk.js`,
				path: isServer ? config.outPath : `${config.outPath}/public`,
				...libOptions
			},
			resolve: {
				extensions: [".tsx", ".ts", ".js", ".jsx", ".json"],
				alias: config.aliases,
				fallback: {
					"fs": false,
					"tls": false,
					"net": false,
					"http": false,
					"https": false,
					"stream": false,
					"crypto": false,
				},
				symlinks: false,
			},
			module: {
				rules: [
					{
						test: /\.(ts|js)x?$/,
						exclude: /node_modules/,
						use: {
							loader: "ts-loader",
							options: {
								transpileOnly: true,
								experimentalWatchApi: true,
							}
						},
					},
					{
						test: /\.js$/,
						use: ["source-map-loader"],
						enforce: "pre"
					}
				],
			},
			plugins: [
				new DefinePlugin({
					env: JSON.stringify({
						isDev: config.dev,
						appEntries
					})
				}),
				new ForkTsCheckerWebpackPlugin({
					typescript: {
						mode: "write-references"
					}
				})
			],
			experiments: {
				topLevelAwait: true
			},
			externals: isServer ? [nodeExternals({ allowlist: ["react","react-dom"] })] : {}
		};
	}

	private readonly dllConfig: webpack.Configuration = {};
	private readonly clientConfig: webpack.Configuration = {};
	private readonly serverConfig: webpack.Configuration = {};

	private clientConfigDllIndex = -1;
	private serverConfigDllIndex = -1;

	public readonly isDev: boolean;
	public readonly outPath: string;

	private _watcher: any | null = null;

	public get isWatching() { return this._watcher !== null; }

	public constructor(config: CompilerConfig)
	{
		this.outPath = config.outPath;
		this.isDev = config.dev || false;
		this.dllConfig = Compiler.createDllConfig(config);
		this.clientConfig = Compiler.createConfig(config, false);
		this.serverConfig = Compiler.createConfig(config, true);
	}

	public updateName(name: string)
	{
		this.clientConfig.name = this.serverConfig.name = name;
	}

	public updateAliases(aliases: { [key: string]: string })
	{
		if (!this.clientConfig.resolve)
			this.clientConfig.resolve = {};
		this.clientConfig.resolve.alias = aliases;

		if (!this.serverConfig.resolve)
			this.serverConfig.resolve = {};
		this.serverConfig.resolve.alias = aliases;
	}

	public updateAppEntries(entries: { [key: string]: string })
	{
		this.clientConfig.entry = entries;
	}

	public updateServerEntry(path: string)
	{
		this.serverConfig.entry = path;
	}

	private updateDllManifest()
	{
		const p = path.resolve(this.outPath, VENDORS_MANIFEST_PATH);

		if (fs.existsSync(p))
		{
			const manifest = require(p);
			if (!this.serverConfig.plugins)
				this.serverConfig.plugins = [];

			if (!this.clientConfig.plugins)
				this.clientConfig.plugins = [];

			const options = {
				manifest,
				context: path.resolve(this.outPath, "..")
			};

			if (this.serverConfigDllIndex > -1)
				this.serverConfig.plugins[this.serverConfigDllIndex] = new DllReferencePlugin(options);
			else
			{
				this.serverConfig.plugins.unshift(new DllReferencePlugin(options));
				this.serverConfigDllIndex = 0;
			}

			if (this.clientConfigDllIndex > -1)
			{
				this.clientConfig.plugins[this.clientConfigDllIndex] = new DllReferencePlugin(options);
			}
			else
			{
				this.clientConfig.plugins.unshift(new DllReferencePlugin(options))
				this.clientConfigDllIndex = 0;
			}
		}
	}

	private hasBuild = false;
	private watchTimeout: NodeJS.Timeout | null = null;

	public watch(onCompile: () => any = () => { })
	{
		// TODO: watch for vendor changes and rebuild the DLL bundle

		const buildDll = () => new Promise<void>((res, rej) => 
		{
			webpack(this.dllConfig, (err, stats) => 
			{
				if (err)
				{
					console.log(err);
					rej(err);
				}
				else
				{
					console.log(stats?.toString("minimal"));
					this.updateDllManifest();
					res();
				}
			});
		});

		const startWatching = async () =>
		{
			const p = path.resolve(this.outPath, "public", "js", "vendor-manifest.json");

			if (!fs.existsSync(p) || !this.hasBuild)
			{
				await buildDll();
				this.hasBuild = true;
			}

			this._watcher = webpack([this.clientConfig, this.serverConfig]).watch({ followSymlinks: false, ignored: ["package.json", "ion.config.json", "tsconfig.json"] }, (err, stats) => 
			{
				if (err)
				{
					console.log(err);
				}
				else
				{
					console.log(stats?.toString("minimal"));
				}

				onCompile();
			})

			// this._watcher.compiler.compilers[0].hooks.beforeCompile.tapAsync("IonClean", (p, cb) => 
			// {
			// 	const out = this.clientConfig.output!.path!;

			// 	fs.readdirSync(out).forEach(dir => 
			// 	{
			// 		if (dir === "js")
			// 		{
			// 			fs.readdirSync(path.resolve(out, "js")).forEach(dir => 
			// 			{
			// 				if (dir !== "vendor-manifest.json")
			// 					rimraf.sync(path.resolve(this.clientConfig.output!.path!, "js", dir));
			// 			});
			// 		}
			// 		else
			// 		{
			// 			rimraf.sync(path.resolve(this.clientConfig.output!.path!, dir));
			// 		}
			// 	});

			// 	cb();
			// });
		}

		if (this._watcher)
		{
			console.log(`Restarting compiler...`);
			this._watcher.close(() => 
			{
				if(this.watchTimeout)
					clearTimeout(this.watchTimeout);
				this.watchTimeout = setTimeout(async () => { await startWatching(); this.watchTimeout = null;  }, 200);
			});
		}
		else
		{
			this.clientConfig.mode = this.serverConfig.mode = "development";
			if(this.watchTimeout)
				clearTimeout(this.watchTimeout);
			this.watchTimeout = setTimeout(async () => { await startWatching(); this.watchTimeout = null;  }, 200);
		}
	}

	public build(onCompile: () => any = () => { })
	{
		this.clientConfig.mode = this.serverConfig.mode = "production";

		webpack([this.clientConfig, this.serverConfig], (err, stats) => 
		{
			if (err)
			{
				console.log(err);
			}
			else
			{
				console.log(stats?.toString("minimal"));
			}

			onCompile();
		});
	}
}

type CompilerConfig = {
	name: string;
	dev?: boolean;
	entries: {
		[key: string]: string;
	};
	aliases: {
		[key: string]: string;
	};
	outPath: string;
	serverEntry: string;
};
