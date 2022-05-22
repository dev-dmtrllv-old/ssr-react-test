import { App } from "../App";
import { Command } from "../Command";
import * as path from "path";

import { ChildProcess, fork } from "child_process";

export default class Watch extends Command
{
	private serverProc: ChildProcess | null = null;

	public get argPattern(): "none"
	{
		return "none";
	}

	private restartServer()
	{
		if(this.serverProc)
			this.serverProc.kill();

		const cwd = path.resolve(App.get().projectPath, "dist");
		const serverFile = path.resolve(App.get().projectPath, "dist", "index.js");
		this.serverProc = fork(serverFile, { cwd, stdio: "inherit" });
	}

	protected onRun()
	{
		App.get().watch(() => 
		{
			console.log(`Compiled :D\n${this.serverProc ? "Res" : "S"}tarting server...`);
			this.restartServer();
		});
	}
}

