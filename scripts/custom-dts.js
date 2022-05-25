const path = require("path");
const fs = require("fs");

const copyCustomDTS = () => fs.cpSync(path.resolve(__dirname, "../custom-dts"), path.resolve(".."), { recursive: true, force: true });

let isWatching = false;

let timeout = null;

const watchDTS = () =>
{
	if (!isWatching)
	{
		isWatching = true;
		fs.watch(path.resolve(__dirname, "../custom-dts"), { recursive: true }, () => 
		{
			if (timeout)
				clearTimeout(timeout);
			timeout = setTimeout(() => 
			{
				copyCustomDTS();
			}, 150);
		});
		fs.watch(path.resolve(__dirname, ".."), { recursive: true }, (e, name) => 
		{
			if (name && name.endsWith(".d.ts") && !name.startsWith("custom-dts"))
			{
				const p = path.resolve(__dirname, "../custom-dts", name);
				if(fs.existsSync(p))
				{
					const pp = path.resolve(__dirname, "..", name);
					fs.copyFileSync(p, pp)
				}
			}
		});
	}
}

module.exports = {
	copyCustomDTS,
	watchDTS
}
