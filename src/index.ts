import { IonApp } from "./IonApp";
import { Async } from "./Async";

export * from "./IonApp";
export * from "./Async";

namespace Ion
{
	export const createApp = IonApp.create;
	export const createAsync = Async.create;
};

export default Ion;
