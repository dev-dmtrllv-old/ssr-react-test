const { run } = require("./run");
const fs = require("fs");
const path = require("path");

const pkg = require("../package.json")

const tgzName = `${pkg.name}-${pkg.version}.tgz`;

const ignore = [
	tgzName,
	"cli",
	"scripts",
	"src",
	"node_modules",
	".git",
	".gitignore",
	"custom-dts"
];

let timeout = null;
let p = null;
let isWatching = false;

const pack = () =>
{
	if (p)
		p.kill();

	if (timeout)
		clearTimeout(timeout);

	timeout = setTimeout(() => 
	{
		p = run("npm pack .");
	}, 500);
}

const watch = () =>
{
	if (!isWatching)
	{
		isWatching = true;
		fs.watch(path.resolve(__dirname, ".."), { recursive: true }, (e, name) => 
		{
			if (name)
			{
				const [p] = name.split(path.sep);

				if (!ignore.includes(p))
					pack();
			}
		});
	}
}

const packAndStart = () =>
{
	if (fs.existsSync(path.resolve(__dirname, "..", tgzName)))
		fs.unlinkSync(path.resolve(__dirname, "..", tgzName));
	pack();
	watch();
}

module.exports = {
	pack,
	packAndStart,
	watch
}
