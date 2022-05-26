import React from "react";
import ReactDOM from "react-dom";
import { IonAppContext } from "./IonAppContext";
import { object } from "./utils";
import { cloneError } from "./utils/object";
import { hash } from "./utils/string";
import type { IonApp } from "./IonApp";

export namespace Async
{
	const componentMap: AsyncComponent<any, any>[] = [];

	const Context = React.createContext<ContextType>({
		data: {},
		resolvers: {},
		resolvedDataStack: [],
		popIndex: 0,
		isMounted: false,
		cache: {},
		fetcher: async () => { },
		abortControllers: {}
	});

	/** @internal */
	export let serverApiFetcher: IonApp.Fetcher = async () => {};

	export const Provider = ({ context, children }: React.PropsWithChildren<{ context: ContextType }>) =>
	{
		React.useEffect(() => 
		{
			context.isMounted = true;

			let promises: Promise<any>[] = [];

			Object.keys(context.resolvers).forEach(id => 
			{
				const [resolver, props] = context.resolvers[id];
				const aborter = context.abortControllers[id];
				promises.push(resolve(resolver, props, context.fetcher, aborter?.signal));
			});

			Promise.all(promises).then(data => 
			{
				ReactDOM.unstable_batchedUpdates(() => 
				{
					Object.keys(context.resolvers).forEach((k, i) => 
					{
						const abortCtrl = context.abortControllers[k];
						if (abortCtrl.signal?.aborted)
						{
							context.data[k] = {
								canceled: (abortCtrl.signal as any).reason || true,
								isInvalidated: false,
								isLoading: false,
							}
							console.log(`Async resolver canceled for ${k}`);
						}
						else
						{
							context.data[k] = data[i];
						}

						context.resolvers[k][2]?.forEach(setState => setState(context.data[k]));
					});
					context.resolvers = {};
				});
			});

			Object.keys(context.cache).forEach(id => 
			{
				const createTimeout = () =>
				{
					const c = context.cache[id];
					if (!Number.isFinite(c.options.duration))
						return;

					if (c.timeout)
						clearTimeout(c.timeout);

					c.timeout = setTimeout(() => 
					{
						const c = context.cache[id];

						if (!c.options.invalidate)
						{
							resolve(c.resolver, c.props, context.fetcher).then(data => 
							{
								context.data[id] = data;

								const c = context.cache[id];

								ReactDOM.unstable_batchedUpdates(() => 
								{
									c.dispatchers.forEach((setState) => setState(data));
								});

								createTimeout();
							});
						}
						else
						{
							ReactDOM.unstable_batchedUpdates(() => 
							{
								delete context.data[id];
								c.dispatchers.forEach((setState) => 
								{
									setState({
										isInvalidated: true,
										isLoading: false,
										canceled: false
									});
								});
								context.cache[id] = {
									...context.cache[id],
									dispatchers: [],
									timeout: null
								};
							});
						}

					}, c.options.duration);
				}

				createTimeout();
			});

			return () => { context.isMounted = false; };
		}, []);

		return (
			<Context.Provider value={context}>
				{children}
			</Context.Provider>
		);
	}

	const createId = <P extends {}>(id: number, props: P) => hash(`${id}.${JSON.stringify(props)}`);

	const resolve = <P extends {}, D>(resolver: Resolver<P, D>, props: P, fetcher: IonApp.Fetcher, signal?: AbortSignal) => new Promise<AsyncData<D>>(async (res) => 
	{
		let data: Awaited<D> | undefined = undefined;
		let error: Error | undefined = undefined;
		let aborted = false;

		try
		{
			serverApiFetcher = fetcher;
			data = await resolver({ ...props, fetch: (url, options) => fetcher(url, { ...options, signal }) } as any);
		}
		catch (e)
		{
			if (e.name === "AbortError")
			{
				aborted = true;
			}
			else
			{
				console.log(e);
				error = cloneError(e);
			}
		}

		if (signal && signal.aborted)
		{
			res({
				isInvalidated: false,
				isLoading: false,
				data,
				error,
				canceled: (signal as any).reason || true
			});
		}
		else
		{
			res({
				isInvalidated: false,
				isLoading: false,
				data,
				error,
				canceled: false
			});
		}
	});

	export const resolveComponents = async (context: ContextType) =>
	{
		let promises: Promise<any>[] = [];

		Object.keys(context.resolvers).forEach(id => 
		{
			const [resolver, props] = context.resolvers[id];
			promises.push(resolve(resolver, props, context.fetcher));
		});

		const data = await Promise.all(promises);

		const map: DataMap = {};

		Object.keys(context.resolvers).forEach((k, i) => map[k] = data[i]);

		context.resolvers = {};

		return map;
	}

	export const useContext = () => React.useContext(Context);

	export const getDynamicPaths = (context: ContextType) =>
	{
		const paths: string[] = [];
		Object.keys(context.data).forEach(id => 
		{
			const d = context.data[id];
			if (d?.data?.__IMPORT_PATH__)
			{
				paths.push(d.data.__IMPORT_PATH__);
				context.data[id].data = { __IS_DYNAMIC_IMPORT__: true };
			}
		});
		return paths;
	}

	const parseCache = (cache?: number | CacheOptions, defaultCacheOptions?: number | CacheOptions): Required<CacheOptions> =>
	{
		let duration = Infinity;
		let invalidate = true;

		if (typeof defaultCacheOptions === "object")
		{
			duration = defaultCacheOptions.duration
			invalidate = defaultCacheOptions.invalidate === undefined ? true : defaultCacheOptions.invalidate;
		}

		if (typeof cache === "number")
		{
			duration = cache;
		}
		else if (typeof cache !== "undefined")
		{
			duration = cache.duration
			invalidate = cache.invalidate === undefined ? true : cache.invalidate;
		}

		return { invalidate, duration };
	}

	export const create = <Props extends {}, Data>(resolver: Resolver<Props, Data>, component: React.FC<Props & ComponentData<Data> & AbortProps>, defaultAsyncProps: AsyncProps = {}): AsyncComponent<Props, Data> =>
	{
		defaultAsyncProps = { prefetch: true, cache: Infinity, ...defaultAsyncProps };

		const c = (({ cache, prefetch, ...props }: Props & ComponentData<Data> & { resolveIndex?: number } & AsyncProps) =>
		{
			prefetch = prefetch === undefined ? defaultAsyncProps.prefetch : prefetch;

			const ctx = useContext();
			const { isResolving, isHydrating } = IonAppContext.use();

			const id = createId(c.id, props);

			const abortController = React.useRef<AbortController | null>(null);

			const propsRef = React.useRef(props);
			const dispatcherIndex = React.useRef(-1);

			const [state, setState] = React.useState<AsyncData<Data>>(() => 
			{
				if (isHydrating)
				{
					const d = ctx.resolvedDataStack[ctx.popIndex];
					ctx.popIndex++;
					if (d)
					{
						if (d.data?.__IS_DYNAMIC_IMPORT__) // filter dynamic imports
						{
							if (ctx.data[id])
							{
								d.data = ctx.data[id];
								return ctx.data[id];
							}

							ctx.resolvers[id] = [resolver, props];
						}

						ctx.data[id] = d;

						ctx.cache[id] = {
							dispatchers: [],
							options: parseCache(cache, defaultAsyncProps.cache),
							timeout: null,
							resolver,
							props
						};

						return d;
					}
				}
				else if (ctx.data[id])
					return ctx.data[id];
				else if (isResolving && prefetch)
					ctx.resolvers[id] = [resolver, props];

				return {
					isLoading: true,
					isInvalidated: false,
					canceled: false
				};
			});

			if (env.isServer && !isResolving)
			{
				ctx.resolvedDataStack.push(state);
			}

			React.useEffect(() => 
			{
				if (!object.equals(propsRef.current, props))
				{
					propsRef.current = props;
				}
				else // on mount
				{
					if (state.isLoading)
					{
						if (ctx.isMounted)
						{
							abortController.current = new AbortController();

							resolve(resolver, props as any, ctx.fetcher, abortController.current.signal).then(d => 
							{
								ctx.data[createId(c.id, props)] = d;
								setState(d);
							});
						}
						else
						{
							if (ctx.resolvers[id] && ctx.resolvers[id][2])
								ctx.resolvers[id][2]!.push(setState);
							else
								ctx.resolvers[id] = [resolver, props, [setState]];

							if (!ctx.abortControllers[id])
								ctx.abortControllers[id] = new AbortController();

							abortController.current = ctx.abortControllers[id];
						}
					}
				}

				const options = parseCache(cache, defaultAsyncProps.cache);

				if (Number.isFinite(options.duration))
				{
					if (!ctx.cache[id])
					{
						console.log(`Cache did not exists for ${id}!`);

						ctx.cache[id] = {
							dispatchers: [],
							options,
							timeout: null,
							resolver,
							props
						};
					}
					if (dispatcherIndex.current === -1)
					{
						let found = false;
						for (let i = 0; i < ctx.cache[id].dispatchers.length; i++)
						{
							if (!ctx.cache[id].dispatchers[i])
							{
								ctx.cache[id].dispatchers[i] = setState
								dispatcherIndex.current = i;
								found = true;
								break;
							}
						}

						if (!found)
							dispatcherIndex.current = ctx.cache[id].dispatchers.push(setState) - 1;

					}
					else
						ctx.cache[id].dispatchers[dispatcherIndex.current] = setState;
				}

				return () =>
				{
					if (dispatcherIndex.current > -1)
						delete ctx.cache[id]?.dispatchers[dispatcherIndex.current];
				}
			}, [props]);

			const abort = (reason?: string) =>
			{
				if (abortController.current)
				{
					abortController.current.abort(reason);
				}
			}

			return React.createElement(component, { ...props as any, ...state, abort });
		}) as unknown as AsyncComponent<Props, Data>;

		c.id = hash(resolver.toString());
		c.component = component;
		c.resolver = resolver;

		componentMap.push(c);

		return c;
	}

	export type Resolver<Props extends {}, Data> = (data: Omit<Props, keyof AsyncProps | "children"> & { fetch: IonApp.Fetcher }) => Data;

	export type ResolverProps<Props extends {} = {}> = Omit<Props, keyof AsyncProps | "children"> & { fetch: IonApp.Fetcher };

	export interface AsyncComponent<Props extends {}, Data> extends React.FC<Props & AsyncProps>
	{
		id: number;
		component: React.FC<Props & ComponentData<Data> & AbortProps>;
		resolver: Resolver<Props, Data>;
	};

	type AsyncProps = {
		cache?: CacheOptions | CacheOptions["duration"];
		prefetch?: boolean;
	};

	export type ContextType = {
		data: DataMap;
		resolvers: Resolvers;
		resolvedDataStack: AsyncData<any>[];
		popIndex: number;
		isMounted: boolean;
		cache: CacheMap;
		fetcher: IonApp.Fetcher;
		abortControllers: {
			[id: string]: AbortController;
		}
	};

	type CacheMap = {
		[id: string]: {
			resolver: Resolver<any, any>;
			props: any;
			options: CacheOptions;
			timeout: NodeJS.Timeout | null;
			dispatchers: StateDispatcher[];
		};
	}

	type DataMap = {
		[key: string]: AsyncData<any>;
	};

	type Resolvers = {
		[key: string]: [Resolver<any, any>, any] | [Resolver<any, any>, any, StateDispatcher[]];
	}

	type StateDispatcher = (state: AsyncData<any>) => void;

	type ComponentData<T> = {
		data?: Awaited<T> | undefined;
		error?: Error | undefined;
		isLoading: boolean;
		isInvalidated: boolean;
		canceled: boolean | string;
	};

	type AsyncData<T> = ComponentData<T> & {
		cache?: CacheOptions;
	};

	type CacheOptions = {
		duration: number;
		invalidate?: boolean;
	};

	type AbortProps = { abort: (reason?: string) => void };
}
