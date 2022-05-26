if(module === undefined)
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


import { IonApp } from "./IonApp";
import { Async } from "./Async";

export * from "./IonApp";
export * from "./Async";
export * from "./Client";
export * from "./Html";
export * from "./Router";
export * as Utils from "./utils";

namespace Ion
{
	export const createApp = IonApp.create;
	export const createAsync = Async.create;
};

export default Ion;

declare global
{
    interface ApiType {}
}
