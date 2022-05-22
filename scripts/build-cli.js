const { rm } = require("./clear");
const { run } = require("./run");
const { pack } = require("./pack");

rm("cli-dist");

let onResolve = () => {};

module.exports = (cb) => onResolve = cb;

Promise.all([
	run("tsc -p cli --sourceMap false")
]).then(() => 
{
	console.log(`done!`);

	if (!global.buildAll)
		pack();
	else
		onResolve();
});
