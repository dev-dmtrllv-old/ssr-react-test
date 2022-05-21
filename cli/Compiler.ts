import webpack, { DefinePlugin } from "webpack";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import nodeExternals from "webpack-node-externals";

import path from "path";

export class Compiler
{
	private static createVendorsConfig(config: CompilerConfig): webpack.Configuration
	{
		return {
			mode: config.dev ? "development" : "production",
			entry: path.resolve(__dirname, "../wrapper.js"),
			output: {
				filename: "vendors.bundle.js",
				path: path.resolve(config.outPath, "public", "js")
			}
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
			globalObject: "this",
		};

		const options: any = isServer ? { target: "node", externalsPresets: { node: true } } : {};

		if (isServer)
		{
			options.entry = config.serverEntry || path.resolve(__dirname, "../server-entry.ts");
		}
		else
		{
			options.entry = config.entries;
		}

		const opt = !isServer ? {
			optimization: {
				splitChunks: {
					chunks: "all",
					cacheGroups: {
						vendor: {
							test: /[\\/]node_modules[\\/]/,
							name: "vendors",
							chunks: "all",
							enforce: true,
						}
					}
				}
			}
		} : {};

		const plugins = isServer ? [] : [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })];

		const tsLoaders: any[] = [{
			loader: "ts-loader",
			options: {
				transpileOnly: true,
				experimentalWatchApi: true,
			}
		}];

		if(!isServer)
			tsLoaders.push(path.resolve(__dirname, "../dynamicImportPathLoader.js"));

		return {
			...options,
			mode: config.dev ? "development" : "production",
			name: config.name,
			devtool: config.dev ? "source-map" : false,
			output: {
				clean: false,
				filename: isServer ? `[name].js` : `js/[name].bundle.js`,
				chunkFilename: isServer ? `[id].js` : `js/[name].[id].chunk.js`,
				path: isServer ? config.outPath : `${config.outPath}/public`,
				...libOptions,
				publicPath: "/"
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
				symlinks: true,
			},
			module: {
				rules: [
					{
						test: /\.(ts|js)x?$/,
						exclude: /node_modules/,
						use: tsLoaders,
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
				}),
				...plugins
			],
			experiments: {
				topLevelAwait: true
			},
			externals: isServer ? [
				nodeExternals()
			] : {
				"react": {
					commonjs: "react",
					commonjs2: "react",
					amd: "React",
					root: "React"
				},
				"react-dom": {
					commonjs: "react-dom",
					commonjs2: "react-dom",
					amd: "ReactDOM",
					root: "ReactDOM"
				},
				"react-dom/client": {
					commonjs: "react-dom/client",
					commonjs2: "react-dom/client",
					amd: "ReactDOM/client",
					root: "ReactDOMClient"
				},
				"react-dom/server": {
					commonjs: "react-dom/server",
					commonjs2: "react-dom/server",
					amd: "ReactDOM/server",
					root: "ReactDOMServer"
				}
			},
			...opt
		};
	}

	private readonly vendorsConfig: webpack.Configuration = {};
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
		this.vendorsConfig = Compiler.createVendorsConfig(config);
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

	public updateServerEntry(path?: string)
	{
		if (path)
			this.serverConfig.entry = path;
		else
			delete this.serverConfig.entry;
	}

	// private updateDllManifest()
	// {
	// 	const p = path.resolve(this.outPath, VENDORS_MANIFEST_PATH);

	// 	if (fs.existsSync(p))
	// 	{
	// 		const manifest = require(p);
	// 		if (!this.serverConfig.plugins)
	// 			this.serverConfig.plugins = [];

	// 		if (!this.clientConfig.plugins)
	// 			this.clientConfig.plugins = [];

	// 		const options = {
	// 			manifest,
	// 			context: path.resolve(this.outPath, "..")
	// 		};

	// 		if (this.serverConfigDllIndex > -1)
	// 			this.serverConfig.plugins[this.serverConfigDllIndex] = new DllReferencePlugin(options);
	// 		else
	// 		{
	// 			this.serverConfig.plugins.unshift(new DllReferencePlugin(options));
	// 			this.serverConfigDllIndex = 0;
	// 		}

	// 		if (this.clientConfigDllIndex > -1)
	// 		{
	// 			this.clientConfig.plugins[this.clientConfigDllIndex] = new DllReferencePlugin(options);
	// 		}
	// 		else
	// 		{
	// 			this.clientConfig.plugins.unshift(new DllReferencePlugin(options))
	// 			this.clientConfigDllIndex = 0;
	// 		}
	// 	}
	// }

	private hasBuild = false;
	private watchTimeout: NodeJS.Timeout | null = null;

	public watch(onCompile: () => any = () => { })
	{
		const buildVendors = () => new Promise<void>((res, rej) => 
		{
			webpack(this.vendorsConfig, (err, stats) => 
			{
				if (err)
				{
					console.log(err);
					rej(err);
				}
				else
				{
					console.log(stats?.toString("minimal"));
					// this.updateDllManifest();
					res();
				}
			});
		});

		const startWatching = async () =>
		{
			if (!this.hasBuild)
			{
				console.log("building vendors...");
				await buildVendors();
				this.hasBuild = true;
			}

			const configs: webpack.Configuration[] = [this.clientConfig];

			if (this.serverConfig.entry)
				configs.push(this.serverConfig);

			this._watcher = webpack(configs).watch({ followSymlinks: true, ignored: ["package.json", "ion.config.json", "tsconfig.json", "dist"] }, (err, stats) => 
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

		if (this._watcher)
		{
			console.log(`Restarting compiler...`);
			this._watcher.close(() => 
			{
				if (this.watchTimeout)
					clearTimeout(this.watchTimeout);
				this.watchTimeout = setTimeout(async () => { await startWatching(); this.watchTimeout = null; }, 200);
			});
		}
		else
		{
			this.clientConfig.mode = this.serverConfig.mode = "development";
			if (this.watchTimeout)
				clearTimeout(this.watchTimeout);
			this.watchTimeout = setTimeout(async () => { await startWatching(); this.watchTimeout = null; }, 200);
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
	serverEntry?: string | undefined;
};
