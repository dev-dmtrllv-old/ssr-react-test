import webpack, { DefinePlugin, } from "webpack";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import nodeExternals from "webpack-node-externals";

export class Compiler
{
	private static createConfig(config: CompilerConfig, isServer: boolean): webpack.Configuration
	{
		const appEntries = isServer ? [Object.keys(config.entries)] : [];

		const libOptions = isServer ? {} : {
			library: {
				type: "umd",
				name: "App"
			},
			libraryTarget: "umd",
			globalObject: "window",
		};

		const options = isServer ? { target: "node" } : {};

		return  {
			...options,
			mode: config.dev ? "development" : "production",
			name: config.name,
			devtool: config.dev ? "source-map" : false,
			entry: isServer ? config.serverEntry : config.entries,
			output: {
				clean: true,
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
					env: {
						isDev: config.dev,
					},
					appEntries
				}),
				new ForkTsCheckerWebpackPlugin({
					typescript: {
						mode: "write-references"
					}
				})
			],
			optimization: isServer ? {} : {
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
			},
			experiments: {
				topLevelAwait: true
			},
			externals: isServer ? [nodeExternals()] : []
		};
	}

	private readonly clientConfig: webpack.Configuration = {};
	private readonly serverConfig: webpack.Configuration = {};

	public readonly isDev: boolean;

	private _watcher: any | null = null;

	public get isWatching() { return this._watcher !== null; }

	public constructor(config: CompilerConfig)
	{
		this.isDev = config.dev || false;

		this.clientConfig = Compiler.createConfig(config, false);
		this.serverConfig = Compiler.createConfig(config, true);
		// this.dllConfig = Compiler.createDllConfig();
	}

	public updateName(name: string)
	{
		this.clientConfig.name = this.serverConfig.name = name;
	}

	public updateAliases(aliases: { [key: string]: string })
	{
		if(!this.clientConfig.resolve)
			this.clientConfig.resolve = {};
		this.clientConfig.resolve.alias = aliases;
		
		if(!this.serverConfig.resolve)
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

	public watch(onCompile: () => any = () => { })
	{
		const startWatching = () =>
		{
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
			});
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
			this.clientConfig.mode = "development";
			this.serverConfig.mode = "development";
			startWatching();
		}
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
