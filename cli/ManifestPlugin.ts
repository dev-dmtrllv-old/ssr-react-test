import { Compiler } from "webpack";

const path = require("path");

const srcDir = path.resolve(__dirname, "..", "src");

export default class ManifestPlugin
{
	cb: (manifest: any) => {};
	rootDir: string;

	constructor(root: string, cb)
	{
		this.rootDir = root;
		this.cb = cb;
	}

	transformPath = (p) =>
	{
		if (p.startsWith("."))
			p = p.substr(1, p.length);
		else if (!p.startsWith(path.sep))
			p = path.sep + p;
		
		return p.replace(srcDir, ".").replaceAll("\\", "/");
	}

	apply = (compiler: Compiler) =>
	{
		compiler.hooks.emit.tapAsync("ManifestPlugin", (c, cb) =>
		{
			const manifest: any = {
				main: {},
				chunks: {}
			};

			for (const { files, name, id } of c.chunks)
			{
				if (name)
				{
					manifest.main[name === "main" ? "app" : name] = {
						id,
						files: []
					};

					files.forEach((p) => manifest.main[name === "main" ? "app" : name].files.push(this.transformPath(p)));
				}
			}

			for (const { chunks, origins } of c.chunkGroups)
			{
				const origin = origins && origins[0];
				if (origin)
				{
					const { request, loc, module } = origin;
					
					let fileName = module?.context ? (path.join(module.context, request).replace(this.rootDir, ".").replaceAll("\\", "/")) :origin.request;
					if (fileName)
					{
						fileName = fileName.replace(srcDir, ".").replaceAll("\\", "/");

						for (const { id, files, ids, entryModule, name, ...rest  } of chunks)
						{
							manifest.chunks[fileName] = {
								id,
								files: []
							};
							files.forEach((p) => manifest.chunks[fileName].files.push(this.transformPath(p)));
						}
					}
				}
			}

			this.cb(manifest);
			cb();
		});
	}
}
