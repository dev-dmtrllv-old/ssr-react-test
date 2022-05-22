const { pack } = require("./pack");

global.buildAll = true;

require("./build-cli")(() => 
{
	require("./build-lib")(() => 
	{
		pack();
	});
});
