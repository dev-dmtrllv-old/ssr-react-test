import { Response, Request } from "express";
import http from "http";
import https from "https";
import { isSubClass } from "../utils";
import { Session } from "./ApiSession";

export class Api implements IApi
{
	public static methods: ApiMethods[] = ["get", "post", "put", "delete"];

	private static isApiType(a: any): a is ApiType<any> { return isSubClass(a, Api); };

	public static create = <T extends ApiScheme>(scheme: T): ApiImplementation<T> =>
	{
		let routes: ParsedApiRoutes<T> = {} as any;
		let flatApi: FlatApi = {};

		const parse = (p: string, a: ApiType<any> | ApiRoute<any>, target: any, path: string) =>
		{
			if (Array.isArray(a))
			{
				const [type, subRoutes] = a;
				let parsedSubRoutes: any = {};
				if (subRoutes)
				{
					for (const k in subRoutes)
						parse(k, subRoutes[k], parsedSubRoutes, path + "/" + p);

				}
				target[p] = {
					type,
					subRoutes: parsedSubRoutes,
					path: path + "/" + p
				};
			}
			else if (Api.isApiType(a))
			{
				target[p] = {
					type: a,
					path: path + "/" + p
				};
			}
			else
			{
				const subRoutes: any = {};

				for (const k in a)
					parse(k, a[k], subRoutes, path + "/" + p);


				target[p] = {
					subRoutes,
					path: path + "/" + p
				}
			}

			if (target[p].type)
			{
				const api = new target[p].type(undefined, undefined);
				let methods: ApiMethods[] = [];
				Api.methods.forEach(m => 
				{
					if (api[m])
						methods.push(m);
				});
				flatApi[path + "/" + p] = [target[p].type, methods];
			}
		}

		for (const k in scheme)
			parse(k, scheme[k], routes, "");

		return {
			api: routes,
			flat: flatApi
		};
	}

	public static createManifest(apiBasePath: string, flatApi: FlatApi)
	{
		const manifest: ApiManifest = {
			routes: {},
			basePath: apiBasePath
		};
		for (const p in flatApi)
			manifest.routes[p] = flatApi[p][1];

		return manifest;
	}

	protected readonly session: Session;

	public constructor(session: Session)
	{
		this.session = session;
	}

	public readonly fetch = (url: string, options?: Omit<http.RequestOptions, "host" | "path"> & { secure?: boolean }) => new Promise<string>((res, rej) => 
	{
		const u = new URL(url);
		const o: http.RequestOptions = {
			host: u.host,
			hostname: u.hostname,
			protocol: u.protocol,
			path: u.pathname,
			...options
		};

		let d = "";

		const target = (options?.secure === undefined || options.secure) ? https : http;

		const req = target.request(o as any, (r) => { r.on("data", data => { d += data }); });
		req.on("error", error => rej(error));
		req.on("close", () => res(d));
		req.end();
	});

	get?(props?: any): any;
	post?(props?: any): any;
	put?(props?: any): any;
	delete?(props?: any): any;
}

export interface ApiImplementation<T extends ApiScheme>
{
	api: ParsedApiRoutes<T>;
	flat: FlatApi;
}

export type FlatApi = {
	[path: string]: [ApiType<any>, ApiMethods[]];
};

export interface IApi
{
	get?(props?: any): any;
	post?(props?: any): any;
	put?(props?: any): any;
	delete?(props?: any): any;
}

export type ApiMethods = keyof IApi;

export type ApiScheme = {
	[path: string]: ApiType<any> | ApiRoute<any>;
};

export type ApiRoute<T extends Api> = ApiType<T> | ApiScheme | [ApiType<T>] | [ApiType<T>, ApiScheme];

export type ParsedApiRoute<T extends Api | undefined, SubRoutes extends ApiScheme | unknown = {}> = {
	type: T extends Api ? ApiType<T> : undefined;
	subRoutes: ParsedApiRoutes<SubRoutes>;
	path: string;
};

type InferApiRouteType<T> = T extends [infer R, ...any] ? R extends ApiType<infer A> ? A : never : never;
type InferApiRouteSubRoutes<T> = T extends [ApiType<any>, infer SubRoutes] ? SubRoutes : never;

export type ParsedApiRoutes<T extends ApiScheme | unknown> = {
	[K in keyof T]: T[K] extends ApiType<infer A> ? ParsedApiRoute<A> :
	T[K] extends [ApiType<any>] | [ApiType<any>, ApiScheme] ? ParsedApiRoute<InferApiRouteType<T[K]>, InferApiRouteSubRoutes<T[K]>> :
	T[K] extends ApiScheme ? ParsedApiRoute<undefined, T[K]> : never;
};

type ApiType<T extends Api = Api> = new (session: Session) => T;

type Promisify<T> = T extends Promise<any> ? T : Promise<T>;

export type CreateClientApi<T extends ApiImplementation<any>> = T extends ApiImplementation<infer S> ? ClientApiRoutes<S> : never;

type ClientApiRoutes<T extends ApiScheme> = {
	[K in keyof T]: T[K] extends ApiType<infer A> ? ClientApi<A, undefined> :
	T[K] extends [ApiType<any>] | [ApiType<any>, ApiScheme] ? ClientApi<InferApiRouteType<T[K]>, InferApiRouteSubRoutes<T[K]>> :
	T[K] extends ApiScheme ? ClientApi<undefined, T[K]> : never;
};

type PickApiMethods<T extends Api, P = Omit<Pick<T, ApiMethods>, OptionalKeys<T>>> = { [K in keyof P]: P[K] };

type PromisifyMethods<T> = {
	[K in keyof T]: T[K] extends (...args: infer Args) => infer R ? (...args: Args) => Promisify<R> : T[K];
};

type ClientApi<A extends Api | unknown, S extends ApiScheme | unknown> =
	(A extends Api ? Readonly<PromisifyMethods<PickApiMethods<A>>> : {}) &
	(S extends ApiScheme ? ClientApiRoutes<S> : {}) &
	((A & S) extends undefined ? {} : { readonly path: string });

export type ApiManifest = {
	routes: {
		[path: string]: ApiMethods[];
	};
	basePath: string;
};
