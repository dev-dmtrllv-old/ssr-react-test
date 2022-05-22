const { run } = require("./run");
const { compile } = require("./compile");
const { rmLib } = require("./clear");
const { pack } = require("./pack");

rmLib();

let onResolve = () => {};

module.exports = (cb) => onResolve = cb;

Promise.all([
	compile("ion", "src/index.ts", ".", "tsconfig.json", false, true, false),
	compile("index", "src/server/index.ts", "server", "src/server/tsconfig.json", false, true, true),
	run("tsc --emitDeclarationOnly"),
	run("tsc --emitDeclarationOnly -p ./src/server/tsconfig.json"),
]).then(() => 
{
	console.log(`done!`);

	if (!global.buildAll)
		pack();
	else
		onResolve();
});
