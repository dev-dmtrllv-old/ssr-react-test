const { spawn } = require("child_process");
const { platform } = require("os");

const run = (cmd) => new Promise((res, rej) => 
{
	const [c, ...args] = cmd.split(" ");

	const proc = spawn(c + (platform() === "win32" ? ".cmd" : ""), args, { stdio: "inherit" });
	
	proc.on("exit", () => res());
	proc.on("error", (e) => rej(e));
});

module.exports = { run };
