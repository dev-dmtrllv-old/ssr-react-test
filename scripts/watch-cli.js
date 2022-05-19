const { run } = require("./run");
const { rm } = require("./clear");

rm("cli-dist");
run("tsc --watch -p cli");
