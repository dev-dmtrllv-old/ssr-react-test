const path = require("path");
const webpack = require("webpack");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
var nodeExternals = require("webpack-node-externals");

const resolve = (...p) => path.resolve(__dirname, "..", ...p);

const createConfig = (name, entry, outDir, dev = false, isServer = false) =>
{
	const output = {
		filename: "[name].js",
		path: resolve(outDir),
		clean: false,
		library: {
			name,
			type: "umd"
		},
		globalObject: "this",
	};

	const aliases = () =>
	{
		const tsConfig = require(resolve("tsconfig.json"));

		const { baseUrl = ".", paths = {} } = tsConfig.compilerOptions;

		const aliases = {};

		Object.keys(paths).forEach(k =>
		{
			const prop = k.replace("/*", "").replace("./", "");

			if (!aliases[prop])
				aliases[prop] = resolve(baseUrl, paths[k][0]);
		});

		return aliases;
	}

	const options = isServer ? { target: "node" } : {};

	const config = {
		...options,
		devtool: dev ? "source-map" : undefined,
		mode: dev ? "development" : "production",
		name,
		entry: entry,
		output,
		resolve: {
			extensions: [".tsx", ".ts", ".js", ".jsx", ".json"],
			alias: aliases(),
			fallback: {
				"fs": false,
				"tls": false,
				"net": false,
				"http": false,
				"https": false,
				"stream": false,
				"crypto": false,
				"path": false,
			}
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
					exclude: /node_modules/,
					use: ["source-map-loader"],
					enforce: "pre"
				}
			],
		},
		plugins: [
			new ForkTsCheckerWebpackPlugin({
				typescript: {
					mode: "write-references"
				}
			}),
			new webpack.DefinePlugin({
				isDevBuild: dev
			})
		],
		externals: [nodeExternals()],
	};

	return config;
}

const watch = (name, entry, outDir, dev = false, isServer = false, watchCallback = () => { }) =>
{
	webpack(createConfig(name, entry, outDir, dev, isServer)).watch({ followSymlinks: true }, (err, stats) => 
	{
		if (err)
		{
			console.error(err, stats);
			watchCallback(err);
		}
		else
		{
			console.log(stats.toString("minimal"));
			watchCallback(err, stats)
		}
	});
}

const compile = (name, entry, outDir, dev = false, isServer = false) => new Promise((res, rej) => 
{
	webpack(createConfig(name, entry, outDir, dev, isServer), (err, stats) => 
	{
		if (err)
		{
			rej(err);
		}
		else
		{
			console.log(stats.toString("minimal"));
			res();
		}
	});
});

module.exports = {
	compile,
	watch
};
