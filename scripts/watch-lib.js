const path = require("path");
const { run } = require("./run");
const { watch } = require("./compile");
const { rmLib } = require("./clear");
const { watchDTS, copyCustomDTS } = require("./custom-dts");

const resolve = (...p) => path.resolve(__dirname, "..", ...p);

rmLib();

watch("ion", { "ion": resolve("src/index.ts"), "utils": resolve("src/utils/index.ts") }, ".", true, false, () => { copyCustomDTS(); });
watch("index", "./src/server/index.ts", "server", true, true, () => { copyCustomDTS(); });
run("tsc --watch --emitDeclarationOnly");
watchDTS();
