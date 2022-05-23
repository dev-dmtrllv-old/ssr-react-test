import { App } from "../App";
import { Command } from "../Command";
import * as path from "path";

import { ChildProcess, fork } from "child_process";

export default class Start extends Command
{
	private serverProc: ChildProcess | null = null;

	public get argPattern(): "none"
	{
		return "none";
	}

	protected onRun()
	{
		const cwd = path.resolve(App.get().projectPath, "dist");
		const serverFile = path.resolve(App.get().projectPath, "dist", "index.js");
		const [,,,...args] = process.argv;
		const proc = fork(serverFile, { cwd, stdio: "inherit", env: { ...process.env, args: args.join(" ") }, });
	}
}

