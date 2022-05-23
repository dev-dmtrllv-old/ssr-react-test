const path = require("path");
const { run } = require("./run");
const { compile } = require("./compile");
const { rmLib } = require("./clear");
const { pack } = require("./pack");


let onResolve = () => {};

const resolve = (...p) => path.resolve(__dirname, "..", ...p);

module.exports = (cb) => onResolve = cb;

rmLib();

Promise.all([
	compile("ion", { "ion": resolve("src/index.ts"), "utils": resolve("src/utils/index.ts") }, ".", false, false),
	compile("index", resolve("src/server/index.ts"), "server", false, true),
	run("tsc --emitDeclarationOnly"),
	
]).then(() => 
{
	console.log(`done!`);
	
	if (!global.buildAll)
	pack();
	else
	onResolve();
});

