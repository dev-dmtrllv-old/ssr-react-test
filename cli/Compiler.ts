import webpack, { DefinePlugin } from "webpack";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import nodeExternals from "webpack-node-externals";

import path from "path";

export class Compiler
{
	private static createConfig(basePath: string, config: CompilerConfig, isServer: boolean): webpack.Configuration
	{
		const tsLoaders: any[] = [
			{
				loader: "ts-loader",
				options: {
					transpileOnly: true,
					experimentalWatchApi: true,
				}
			}
		];

		if (isServer)
			tsLoaders.push(path.resolve(__dirname, "../dynamicImportPathLoader.js"));

		const c: webpack.Configuration = {
			mode: config.dev ? "development" : "production",
			name: config.name,
			devtool: config.dev ? "source-map" : false,
			output: {
				clean: false,
				filename: isServer ? `[name].js` : `js/[name].bundle.js`,
				chunkFilename: isServer ? `[id].js` : `js/[name].[id].chunk.js`,
				path: isServer ? config.outPath : `${config.outPath}/public`,
				publicPath: "/",
			},
			resolve: {
				modules: ["node_modules"],
				extensions: [".tsx", ".ts", ".js", ".jsx", ".json"],
				fallback: {
					"fs": false,
					"tls": false,
					"net": false,
					"http": false,
					"https": false,
					"stream": false,
					"crypto": false,
				}
			},
			plugins: [],
			module: {
				rules: [
					{
						test: /\.(ts|js)x?$/,
						exclude: /node_modules/,
						use: tsLoaders,
					},
					{
						test: /\.js$/,
						exclude: /node_modules/,
						use: ["source-map-loader"],
						enforce: "pre"
					}
				],
			},
			experiments: {
				topLevelAwait: true
			},
			externals: isServer ? [
				nodeExternals()
			] : {}
		};

		if (isServer)
		{
			c.plugins = [
				new DefinePlugin({
					env: JSON.stringify({
						isDev: config.dev,
						appEntries: Object.keys(config.entries)
					})
				}),
				new ForkTsCheckerWebpackPlugin({
					typescript: {
						mode: "write-references"
					}
				}),
				new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })
			];
			c.target = "node";
			c.externalsPresets = { node: true };
			c.entry = {
				"index": path.resolve(__dirname, "../server-entry.ts"),
				...config.entries
			};
			c.output!.library = "App";
			c.output!.libraryTarget = "commonjs";
		}
		else
		{
			c.plugins = [
				new DefinePlugin({
					env: JSON.stringify({
						isDev: config.dev
					})
				}),
				new ForkTsCheckerWebpackPlugin({
					typescript: {
						mode: "write-references"
					}
				}),
			]
			c.entry = config.entries;
			c.optimization = {
				runtimeChunk: "single",
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
			};
		}

		return c;
	}

	private readonly clientConfig: webpack.Configuration = {};
	private readonly serverConfig: webpack.Configuration = {};

	private watchTimeout: null | NodeJS.Timeout = null;

	public readonly isDev: boolean;
	public readonly outPath: string;

	private _watcher: any | null = null;

	public get isWatching() { return this._watcher !== null; }

	public constructor(basePath: string, config: CompilerConfig)
	{
		this.outPath = config.outPath;
		this.isDev = config.dev || false;
		this.clientConfig = Compiler.createConfig(basePath, config, false);
		this.serverConfig = Compiler.createConfig(basePath, config, true);
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

	public watch(onCompile: () => any = () => { })
	{
		const startWatching = async () =>
		{
			if (this.watchTimeout)
				clearTimeout(this.watchTimeout);

			this.watchTimeout = setTimeout(() =>
			{
				this._watcher = webpack([this.clientConfig, this.serverConfig]).watch({ followSymlinks: true, ignored: ["package.json", "ion.config.json", "tsconfig.json", "dist"] }, (err, stats) => 
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
			}, 150);
		}

		if (this._watcher)
		{
			console.log(`Restarting compiler...`);
			this._watcher.close(() => 
			{
				startWatching();
			});
		}
		else
		{
			this.clientConfig.mode = this.serverConfig.mode = "development";
			startWatching();
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
