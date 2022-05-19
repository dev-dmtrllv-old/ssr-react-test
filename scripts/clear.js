const rimraf = require("rimraf");
const path = require("path");

const rm = (p) => rimraf.sync(path.resolve(__dirname, "..", p));

module.exports = {
	rm,
	rmLib: () =>
	{
		rm("ion.js");
		rm("ion.js.map");
		rm("server.js");
		rm("server.js.map");
		rm("types");
	}
};
