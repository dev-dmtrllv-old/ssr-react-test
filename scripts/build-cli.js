const { rm } = require("./clear");
const { run } = require("./run");

rm("cli-dist");
run("tsc -p cli --sourceMap false");
