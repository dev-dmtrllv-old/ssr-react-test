const { run } = require("./run");
const fs = require("fs");
const path = require("path");

const ignore = [
	"cli",
	"scripts",
	"src",
	"ion-1.0.0.tgz",
	"node_modules",
	".git"
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
				{
					console.log("changed! " + name);
					pack();
				}
			}
		});
	}
}

const packAndStart = () =>
{
	if (fs.existsSync(path.resolve(__dirname, "../ion-1.0.0.tgz")))
		fs.unlinkSync(path.resolve(__dirname, "../ion-1.0.0.tgz"));
	pack();
	watch();
}

module.exports = {
	pack,
	packAndStart,
	watch
}
