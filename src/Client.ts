import { Async } from "./Async";
import { IonApp } from "./IonApp";
import type { ApiImplementation, ApiManifest, ApiScheme, CreateClientApi } from "./server";
import { object } from "./utils";

type ClientApi = ApiType extends ApiImplementation<any> ? CreateClientApi<ApiType> : null;

export namespace Client
{
	export let api: ClientApi = null;

	export const updateApi = (apiManifest: ApiManifest) =>
	{
		let clientApi: CreateClientApi<any> = {};

		for (const path in apiManifest.routes)
		{
			const [, ...parts] = path.split("/");
			
			let target: any = clientApi;

			parts.forEach(p =>
			{
				if (!target[p])
					target[p] = {};
				target = target[p];
			});

			apiManifest.routes[path].forEach(m => 
			{
				if (m === "get")
					target[m] = (props: any) => IonApp.clientFetcher(apiManifest.basePath + path + `?${object.serialize(props || {})}`, { method: m.toUpperCase() });
				else
					target[m] = (props: any) => IonApp.clientFetcher(apiManifest.basePath + path, { method: m.toUpperCase(), body: JSON.stringify(props || {}) });
			});
		}

		api = clientApi as any;
	}

	/** @internal */
	export const updateApiForServer = <T extends ApiScheme>(apiBasePath: string, apiImplementation: ApiImplementation<T>) =>
	{
		if (!api)
		{
			const { flat } = apiImplementation;

			let clientApi: CreateClientApi<any> = {};

			for (let p in flat)
			{
				const methods = flat[p][1];
				const [, ...parts] = p.split("/");
				let target: any = clientApi;
				for (let p of parts)
				{
					if (!target[p])
						target[p] = {};
					target = target[p];
				}
				for (const m of methods)
				{
					if (m === "get")
						target[m] = (props: any) => Async.serverApiFetcher(apiBasePath + p + `?${object.serialize(props || {})}`, { method: m.toUpperCase() });
					else
						target[m] = (props: any) => Async.serverApiFetcher(apiBasePath + p, { method: m.toUpperCase(), body: JSON.stringify(props || {}) });
				}
			}

			api = clientApi as any;
		}
	}
}
