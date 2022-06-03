// import { Async } from "./Async";
import { ApiManifest } from "./server";

export type SSRData = {
	// async: Async.ContextType["resolvedDataStack"];
	api: ApiManifest;
	renderError?: Error;
	apps: {
		[url: string]: string[];
	};
	title: string;
};

export const getSSRData = () =>
{
	const ssrData: SSRData = JSON.parse(decodeURIComponent(escape(atob((window as any).__SSR_DATA__))));
	(window.__SSR_DATA__ as any) = undefined;
	return ssrData;
}

export default SSRData;
