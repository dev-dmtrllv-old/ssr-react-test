import "../env";

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
