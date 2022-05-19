const path = require("path");
const webpack = require("webpack");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
var nodeExternals = require("webpack-node-externals");

const resolve = (...p) => path.resolve(__dirname, "..", ...p);

const createConfig = (name, entry, outDir, tsConfigPath = "tsconfig.json", dev = false, lib = false, isServer = false) =>
{
	const output = {
		filename: lib ? `${name}.js` : `${name}.bundle.js`,
		path: resolve(outDir),
		publicPath: "/",
		clean: false,
		library: {
			name,
			type: "umd"
		},
		globalObject: 'this',
	};

	const aliases = () =>
	{
		const tsConfig = require(resolve(tsConfigPath));

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
		entry: resolve(entry),
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
			new ForkTsCheckerWebpackPlugin({
				typescript: {
					mode: "write-references"
				}
			}),
			new webpack.DefinePlugin({
				env: {
					isDev: dev
				}
			})
		],
		externals: isServer ? [nodeExternals()] : {
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
				root: "ReactDOM/client"
			}
		},
	};

	return config;
}

const watch = (name, entry, outDir, tsConfigPath = "tsconfig.json", dev = false, lib = false, isServer = false, watchCallback = () => { }) =>
{
	webpack(createConfig(name, entry, outDir, tsConfigPath, dev, lib, isServer)).watch({}, (err, stats) => 
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

const compile = (name, entry, outDir, tsConfigPath = "tsconfig.json", dev = false, lib = false, isServer = false) => new Promise((res, rej) => 
{
	webpack(createConfig(name, entry, outDir, tsConfigPath, dev, lib, isServer), (err, stats) => 
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
