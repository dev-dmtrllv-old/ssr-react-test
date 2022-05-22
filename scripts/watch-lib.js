const { run } = require("./run");
const { watch } = require("./compile");

const { rmLib } = require("./clear");

rmLib();

watch("ion", "src/index.ts", ".", "tsconfig.json", true, true, false);
run("tsc --watch --emitDeclarationOnly");
watch("index", "src/server/index.ts", "server", "tsconfig.json", true, true, true);
run("tsc --watch --emitDeclarationOnly -p ./src/server/tsconfig.json");
