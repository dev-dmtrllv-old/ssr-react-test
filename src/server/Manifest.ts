import fs from "fs";
import path from "path";

export class Manifest
{
	private data: ManifestData = {
		main: {
			app: {
				files: [],
				id: ""
			},
			runtime: {
				files: [],
				id: ""
			},
			vendors: {
				files: [],
				id: ""
			}
		},
		chunks: {}
	};

	private readonly defaultScripts: string[] = [];
	private readonly defaultStyles: string[] = [];

	public getChunkId = (path: string) => this.data.chunks[path].id;

	public constructor()
	{
		if (env.isClient)
			return;

		const data = fs.readFileSync(path.resolve(process.cwd(), "manifest.json"), "utf-8");
		this.data = JSON.parse(data);

		this.defaultScripts = [
			...this.getPaths(true, "runtime", "js"),
			...this.getPaths(true, "vendors", "js"),
		];

		this.defaultStyles = [
			...this.getPaths(true, "runtime", "css"),
			...this.getPaths(true, "vendors", "css"),
		];
	}

	private getPaths = (main: boolean, target: string, extension: string) => (this.data[main ? "main" : "chunks"] as any)[target]?.files.filter((s: string) => s.endsWith(extension));

	public get = (appPath: string, imports: string[], extension: "css" | "js") =>
	{
		const paths = [...(extension === "js" ? this.defaultScripts : this.defaultStyles)];

		Object.keys(this.data.chunks).forEach(s => 
		{
			for (let i of imports)
			{
				if (s.startsWith(i))
				{
					this.data.chunks[s]?.files.forEach(f => 
					{
						if (f.endsWith(extension) && !paths.includes(f))
							paths.push(f);
					});
				}
			}
		});
		paths.push(...this.getPaths(true, appPath, extension))
		return paths;
	}
}

export type ChunkInfo = {
	id: string;
	files: string[];
};

type ManifestData = {
	main: { app: ChunkInfo; runtime: ChunkInfo; vendors: ChunkInfo; };
	chunks: { [key: string]: ChunkInfo; };
};
