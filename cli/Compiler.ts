import webpack, { DefinePlugin } from "webpack";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import nodeExternals from "webpack-node-externals";

import ManifestPlugin from "./ManifestPlugin";

import path from "path";
import { mkdirSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "fs";
import MiniCssExtractPlugin from "mini-css-extract-plugin";

export class Compiler
{
	private static createBaseConfig(name: string, dev: boolean): MarkRequired<webpack.Configuration, "module" | "resolve" | "plugins" | "experiments" | "mode" | "name" | "devtool" | "output">
	{
		return {
			mode: dev ? "development" : "production",
			name: name,
			output: {},
			devtool: dev ? "inline-source-map" : false,
			resolve: {
				modules: ["node_modules"], // needed ???
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
				rules: []
			},
			experiments: {
				topLevelAwait: true
			}
		};
	}

	private static createClientConfig(basePath: string, { outPath, dev = false, name, entries }: CompilerConfig)
	{
		const config = this.createBaseConfig(name, dev);

		config.output = {
			clean: false,
			filename: "js/[name].bundle.js",
			chunkFilename: "js/[id].[fullhash].js",
			path: `${outPath}/public`,
			publicPath: "/",
		};

		config.plugins = [
			new MiniCssExtractPlugin({
				filename: `css/[name].bundle.css`,
				chunkFilename: `css/[id].chunk.css`,
				ignoreOrder: false
			}),
			new DefinePlugin({
				env: JSON.stringify({
					isDev: dev,
					isClient: true,
					isServer: false
				})
			}),
			new ForkTsCheckerWebpackPlugin({
				typescript: {
					mode: "write-references"
				}
			}),
			new ManifestPlugin(basePath, (manifest) => 
			{
				mkdirSync(outPath, { recursive: true });
				writeFileSync(path.resolve(outPath, "manifest.json"), JSON.stringify(manifest), "utf-8");
			}),
		];

		config.entry = entries;
		config.optimization = {
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

		config.module.rules = [
			{
				loader: "ts-loader",
				options: {
					transpileOnly: true,
					experimentalWatchApi: true,
				}
			},
			{
				loader: path.resolve(__dirname, "../dynamicImportPathLoader.js"),
				options: {
					root: basePath,
					dev
				}
			},
			{
				test: /\.(glsl|vert|frag)$/i,
				use: "raw-loader",
			},
			{
				test: /\.s?(c|a)ss$/,
				use: [
					MiniCssExtractPlugin.loader,
					"css-loader",
					"sass-loader",
				],
				exclude: /node_modules/
			},
			{
				test: /\.(jpe?g|png|gif|svg|ico|webp)$/i,
				use: {
					loader: "url-loader",
					options: {
						fallback: "file-loader",
						limit: 40000,
						name: "images/[name].[ext]",
					},
				},
			}
		];
		return config;
	}

	private static createServerConfig(basePath: string, { name, dev = false, entries, serverEntry, outPath }: CompilerConfig)
	{
		const config = this.createBaseConfig(name, dev);
		config.externals = [nodeExternals()];
		config.target = "node";
		config.externalsPresets = { node: true };
		config.entry = {
			index: serverEntry || path.resolve(__dirname, "../server-entry.ts"),
			...entries,
		};
		config.output = {
			clean: false,
			filename: "[name].js",
			chunkFilename: "[id].[fullhash].js",
			path: `${outPath}`,
			publicPath: "/",
		};
		config.output!.library = "App";
		config.output!.libraryTarget = "commonjs";
		config.plugins = [
			new DefinePlugin({
				env: JSON.stringify({
					isDev: dev,
					appEntries: Object.keys(entries),
					isClient: false,
					isServer: true
				})
			}),
			new ForkTsCheckerWebpackPlugin({
				typescript: {
					mode: "write-references"
				}
			}),
			new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
		];
		config.module.rules = [
			{
				loader: "ts-loader",
				options: {
					transpileOnly: true,
					experimentalWatchApi: true,
				}
			},
			{
				loader: path.resolve(__dirname, "../dynamicImportPathLoader.js"),
				options: {
					root: basePath,
					dev
				}
			},
			{
				test: /\.(glsl|vert|frag|s?(c|a)ss)$/i,
				use: "ignore-loader",
			},
			{
				test: /\.(jpe?g|png|gif|svg|ico|webp)$/i,
				use: {
					loader: "url-loader",
					options: {
						fallback: "file-loader",
						limit: 40000,
						name: "images/[name].[ext]",
					},
				},
			}
		];
		return config;
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
		this.clientConfig = Compiler.createClientConfig(basePath, config);
		this.serverConfig = Compiler.createServerConfig(basePath, config);
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
				rmSync(this.outPath, { force: true, recursive: true });

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
				}).watchings[1].compiler.hooks.beforeRun.tapAsync("clean-plugin", (compilation, cb) => 
				{
					readdirSync(this.serverConfig.output!.path!).forEach((name) => 
					{
						if (name.endsWith(".js"))
							unlinkSync(path.resolve(this.serverConfig.output!.path!, name));
					});
					cb();
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
			(this.serverConfig.module!.rules![1] as any).options.dev = true;
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

type A = MarkRequired<CompilerConfig, "dev", true>;

type MarkRequired<T, K extends keyof T, MakeRestPartial extends boolean = false> = Required<Pick<T, K>> & (MakeRestPartial extends true ? Partial<Omit<T, K>> : Omit<T, K>);
