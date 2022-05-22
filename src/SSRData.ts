import { Async } from "./Async";

export type SSRData = {
	async: Async.ContextType["resolvedDataStack"];
};
