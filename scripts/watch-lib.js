const { run } = require("./run");
const { watch } = require("./compile");

const { rmLib } = require("./clear");

rmLib();


watch("ion", "src/index.ts", ".", "tsconfig.json", true, true, false, (err) => 
{
	if (!err)
		run("tsc --emitDeclarationOnly");
});

watch("index", "src/server/index.ts", "server", "tsconfig.json", true, true, true, (err) => 
{
	if (!err)
		run("tsc --emitDeclarationOnly -p ./src/server/tsconfig.json");
});

