if (module === undefined)
{
	window.env = {
		isClient: true,
		isServer: false
	};
}
else
{
	(global as any).env = {
		isClient: false,
		isServer: true
	};
}

export * from "./Server";
export * from "./Api";

import { Server } from "./Server";

export default Server;

declare global
{
	interface SessionType
	{

	}
}
