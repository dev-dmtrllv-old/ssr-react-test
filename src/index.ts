import "./env";

import { IonApp } from "./IonApp";
import { Async } from "./Async";
import { Static } from "./Static";
import { Context } from "./Context";

export * from "./IonApp";
// export * from "./Async";
export * from "./Client";
export * from "./Html";
// export * from "./Router";
export * from "./Static";
export * as Utils from "./utils";

namespace Ion
{
	export const createApp = IonApp.create;
	export const createAsync = Async.create;
	// export const createDynamic = Async.createDynamic;
	export const createStatic = Static.create;
	export const createContext = Context.create;
};

export default Ion;

declare global
{
    interface ApiType {}
}
