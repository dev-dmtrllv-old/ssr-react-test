import { App } from "../App";
import { Command } from "../Command";

export default class Watch extends Command
{
	public get argPattern(): "none"
	{
		return "none";
	}
	
	protected onRun()
	{
		App.get().watch();
	}
}

