const path = require("path");
const { run } = require("./run");
const { watch } = require("./compile");
const { rmLib } = require("./clear");

const resolve = (...p) => path.resolve(__dirname, "..", ...p);

rmLib();

watch("ion", { "ion": resolve("src/index.ts"), "utils": resolve("src/utils/index.ts") }, ".", true, false);
watch("index", "./src/server/index.ts", "server", true, true);
run("tsc --watch --emitDeclarationOnly");
