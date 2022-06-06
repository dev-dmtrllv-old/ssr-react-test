import React from "react";
import { RenderContext, Renderer } from "./Renderer";
import { hash } from "./utils/string";
import { Context } from "./Context"
import { object } from "./utils";
import { cloneError } from "./utils/object";
import { Static } from "./Static";
import ReactDOM from "react-dom";

export namespace Async
{
	export const CACHE_INVALIDATED = Symbol("CACHE_INVALIDATED");

	const defaultProps: Required<FCProps> = {
		cache: Infinity,
		prefetch: true,
	};

	const resolve = async (resolver: Resolver<any, any>, props: any): Promise<Data<any>> =>
	{
		try
		{
			return {
				data: await resolver(props),
				isLoading: false,
				invalidated: false,
				error: undefined
			}
		}
		catch (e)
		{

			return {
				error: cloneError(e),
				isLoading: false,
				invalidated: false,
				data: undefined
			}
		}
	}

	export const flushRenderStack = async (context: ContextType, renderStack: RenderStack) => context.renderStack = renderStack;

	export const resolveComponent = async (id: string, context: ContextType, { components, props, resolver, stateDispatchers }: ResolverInfo, onResolved: OnResolvedCallback) =>
	{
		const data = context.data[id] = await resolve(resolver, props);
		const resolvedPromises: Promise<any>[] = [];

		for (const { component, contexts } of components)
			resolvedPromises.push(onResolved(component, { ...props, ...data }, contexts));
			
		await Promise.all(resolvedPromises);

		if (stateDispatchers.length > 0)
			ReactDOM.unstable_batchedUpdates(() => stateDispatchers.forEach(s => s(data)));
	}

	export const resolveComponents = (context: ContextType, onResolved: OnResolvedCallback) => new Promise<void>((res) => 
	{
		const resolvers = object.moveAndReplace(context, "resolvers", {});

		let toResolveCount = Object.keys(resolvers).length;

		if (toResolveCount === 0)
		{
			res();
		}
		else
		{
			let resolvedCount = 0;
			for (const id in resolvers)
			{
				resolveComponent(id, context, resolvers[id], onResolved).then(() => 
				{
					resolvedCount++;
					if (resolvedCount === toResolveCount)
						res();
				});
			}
		}
	});

	const getData = (context: RenderContext, id: string, isPrefetchComponent: boolean = false) => 
	{
		let data: Data<any> | undefined = context.async.data[id];

		if (data)
			return data;

		if (Renderer.isHydrating(context) && isPrefetchComponent)
		{
			data = context.async.renderStack[context.async.hydrateIndex++];
			context.async.data[id] = data;
		}

		return data;
	};

	const addAsyncResolver = (renderContext: RenderContext, id: string, fc: React.FC<any>, props: any, resolver: Resolver<any, any>, cacheInfo: CacheOptions, stateDispatcher?: (state: Data<any>) => any): Data<any> =>
	{
		const data = {
			isLoading: true,
			invalidated: false,
			error: undefined,
			data: undefined
		};

		const resolveInfo = {
			component: fc,
			props,
			contexts: Renderer.copyCurrentContexts(renderContext)
		};

		if (!renderContext.async.resolvers[id])
		{
			renderContext.async.resolvers[id] = {
				components: [resolveInfo],
				props,
				resolver,
				stateDispatchers: [],
				cacheInfo
			};
		}
		else
		{
			renderContext.async.resolvers[id].components.push(resolveInfo);
		}

		if (stateDispatcher)
		{
			renderContext.async.resolvers[id].stateDispatchers.push(stateDispatcher)
		}

		return data;
	}

	const parseCacheProp = (cache: number | CacheOptions): CacheOptions =>
	{
		if (typeof cache === "number")
		{
			return {
				duration: cache,
				type: "invalidate"
			};
		}

		return cache;
	}

	export const updateCache = (context: RenderContext, id: string, cache: CacheOptions, dispatchIndex: number, stateDispatcher: stateDispatcher, resolver: Resolver<any, any>, props: any) =>
	{
		const createTimeout = () =>
		{
			console.log(`created timeout with duration: ${cache.duration} and type: ${cache.type}`);
			return setTimeout(() => 
			{
				if (cache.type === "invalidate")
				{
					context.async.data[id] = {
						isLoading: false,
						data: undefined,
						error: undefined,
						invalidated: CACHE_INVALIDATED
					}
					console.log("cache invalidated", context.async.cacheDispatchers[id].stateDispatchers)
					ReactDOM.unstable_batchedUpdates(() => 
					{
						context.async.cacheDispatchers[id].stateDispatchers.forEach(s => s(context.async.data[id]));
					});
				}
				else
				{
					resolve(resolver, props).then(d => 
					{
						context.async.data[id] = d;
						ReactDOM.unstable_batchedUpdates(() => 
						{
							context.async.cacheDispatchers[id].stateDispatchers.forEach(s => s(d));
						});
					});
				}
			}, cache.duration);
		}

		if (!context.async.cacheDispatchers[id])
			context.async.cacheDispatchers[id] = {
				cache,
				stateDispatchers: [],
				timeout: null
			};

		const c = context.async.cacheDispatchers[id];

		if (!c.timeout && Number.isFinite(cache.duration))
			c.timeout = createTimeout();

		if (dispatchIndex === -1)
		{
			for (let i = 0; i < c.stateDispatchers.length; i++)
			{
				if (!c.stateDispatchers[i])
				{
					c.stateDispatchers[i] = stateDispatcher;
					return i;
				}
			}

			return c.stateDispatchers.push(stateDispatcher) - 1;
		}

		c.stateDispatchers[dispatchIndex] = stateDispatcher;

		return dispatchIndex;
	}

	const removeCacheDispatcher = (context: RenderContext, id: string, dispatchIndex: number) =>
	{
		if (dispatchIndex <= -1)
			return;

		if (context.async.cacheDispatchers[id] && context.async.cacheDispatchers[id].stateDispatchers[dispatchIndex])
			delete context.async.cacheDispatchers[id].stateDispatchers[dispatchIndex];
	}

	export const create = <Props extends {}, D>(resolver: Resolver<Props, D>, fc: React.FC<Props & Data<D extends Promise<infer P> ? P : D>>, defaultAsyncProps: Required<FCProps> = defaultProps): FC<Props> =>
	{
		const c = ((props: Props & FCProps) => 
		{
			const { cache, prefetch, ...rest } = { ...defaultAsyncProps, ...props };

			const cacheInfo = parseCacheProp(cache);

			const fcProps = rest as any as Props;

			const createId = () => `${c.id}.${hash(JSON.stringify(props))}`;

			const propsSignature = React.useMemo(() => hash(JSON.stringify(fcProps)), [props]);

			const cacheDispatchIndex = React.useRef(-1);

			const id = React.useMemo(createId, [props]);

			const idRef = React.useRef(id);

			const didResolveOnMount = React.useRef(false);

			const renderContext = Renderer.useContext();

			const [state, setState] = React.useState<Data>(() => 
			{
				let data = getData(renderContext, id, prefetch);

				if (data)
					return data;

				if (Renderer.isResolving(renderContext) && prefetch)
					return addAsyncResolver(renderContext, id, fc, fcProps, resolver, cacheInfo);

				return {
					isLoading: true,
					invalidated: false,
					data: undefined,
					error: undefined
				};
			});

			if (env.isServer && !Renderer.isResolving(renderContext))
				renderContext.async.renderStack.push(state);

			React.useEffect(() => 
			{
				const newSignature = hash(JSON.stringify(fcProps));
				if (newSignature != propsSignature)
				{
					console.log("prop changed");
					removeCacheDispatcher(renderContext, idRef.current, cacheDispatchIndex.current);
					idRef.current = id;
					resolve(resolver, fcProps).then(d => 
					{
						if (id === createId())
						{
							renderContext.async.data[id] = d;
							cacheDispatchIndex.current = updateCache(renderContext, id, cacheInfo, cacheDispatchIndex.current, setState, resolver, fcProps);
							setState(d);
						}
					});
				}
				else
				{
					let data = getData(renderContext, id, prefetch);

					if (!data)
					{
						if (renderContext.async.didMount)
						{
							console.log("resolve");
							resolve(resolver, fcProps).then(d => 
							{
								if (id === createId())
								{
									renderContext.async.data[id] = d;
									cacheDispatchIndex.current = updateCache(renderContext, id, cacheInfo, cacheDispatchIndex.current, setState, resolver, fcProps);
									setState(d);
								}
							});
							renderContext.async.data[id] = state;
						}
						else
						{
							console.log("mount resolve");
							addAsyncResolver(renderContext, id, fc, fcProps, resolver, cacheInfo, setState);
							didResolveOnMount.current = true;
							console.log(cacheDispatchIndex.current);
						}
					}
				}
			}, [fcProps]);

			React.useEffect(() => 
			{
				if (!state.isLoading && didResolveOnMount.current)
					cacheDispatchIndex.current = updateCache(renderContext, id, cacheInfo, cacheDispatchIndex.current, setState, resolver, fcProps);

				return () => removeCacheDispatcher(renderContext, id, cacheDispatchIndex.current);
			}, [state]);

			if (Renderer.isStaticRender(renderContext))
				return Static.renderAsDynamicComponent(c, props, id);

			return React.createElement(fc, { ...fcProps, ...state });
		}) as FC<Props>;

		c.id = hash(fc.toString());

		return c;
	}

	type OnResolvedCallback = (component: React.FC<any>, props: any, context: Map<Context<any>, any>) => Promise<void>;

	type stateDispatcher = (state: Data<any>) => any;

	export const createResolver = <P extends {}, Data>(fn: (props: P) => Data): Resolver<P, Data> => fn;

	export type Resolver<Props extends {}, Data> = (data: Omit<Props, keyof FCProps | "children"> & {}) => (Promise<Data> | Data);

	type FC<P extends {}> = React.FC<P & FCProps> & {
		id: number;
	};

	type FCProps = {
		prefetch?: boolean;
		cache?: number | CacheOptions;
	};

	type CacheOptions = {
		duration: number;
		type: "invalidate" | "resolve";
	};

	export type ContextType = {
		didMount: boolean;
		data: DataMap;
		resolvers: ResolversMap;
		renderStack: RenderStack;
		hydrateIndex: number;
		cacheDispatchers: CacheUpdateDispatchers;
	};

	type Data<T = any> = {
		data: T | undefined;
		error: Error | undefined;
		isLoading: boolean;
		invalidated: boolean | string | Symbol;
	};

	export type DataMap = {
		[key: string]: Data<any>;
	};

	type ResolverComponentInfo = {
		component: React.FC<any>;
		contexts: Map<Context<any>, any>;
	};

	type ResolverInfo = {
		props: any;
		components: ResolverComponentInfo[];
		resolver: Resolver<any, any>;
		stateDispatchers: stateDispatcher[];
		cacheInfo: CacheOptions;
	};

	type ResolversMap = {
		[key: string]: ResolverInfo;
	};

	type CacheUpdateDispatchers = {
		[key: string]: {
			cache: CacheOptions;
			timeout: NodeJS.Timeout | null;
			stateDispatchers: ((state: Data<any>) => any)[];
		};
	};

	type RenderStack = Data[];
}
