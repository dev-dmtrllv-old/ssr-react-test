const { spawn } = require("child_process");
const { platform } = require("os");

const run = (cmd) => 
{
	const [c, ...args] = cmd.split(" ");
	const proc = spawn(c + (platform() === "win32" ? ".cmd" : ""), args, { stdio: "inherit" });

	proc.promise = new Promise((res, rej) => 
	{
		proc.on("exit", () => res());
		proc.on("error", (e) => rej(e));
	});

	return proc;
}

module.exports = { run };
