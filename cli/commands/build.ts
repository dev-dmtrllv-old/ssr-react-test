import { App } from "../App";
import { Command } from "../Command";

export default class Build extends Command
{
	public get argPattern(): "none"
	{
		return "none";
	}

	protected onRun()
	{
		App.get().build(() => 
		{
			console.log(`Build :D`);
		});
	}
}

