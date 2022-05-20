const { run } = require("./run");
const { watch } = require("./compile");

const { rmLib } = require("./clear");

rmLib();

let procLib = null;
let procLibServer = null;

watch("ion", "src/index.ts", ".", "tsconfig.json", true, true, false, async (err) => 
{
	if (!err)
	{
		
		if (procLib)
			procLib.kill();
		
		procLib = run("tsc --emitDeclarationOnly");
		
		await procLib.promise;
		
		console.log("lib declaration created!");
	}
});

watch("index", "src/server/index.ts", "server", "tsconfig.json", true, true, true, async (err) => 
{
	if (!err)
	{
		
		if (procLibServer)
			procLibServer.kill();
		
		procLibServer = run("tsc --emitDeclarationOnly -p ./src/server/tsconfig.json");

		await procLibServer.promise;

		console.log("server lib declaration created!");
	}
});

